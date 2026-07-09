import { Router } from 'express'
import { z } from 'zod'
import { Section } from '@prisma/client'

import { prisma } from '../prisma.js'
import { computeItemSubtotal, getBillStatus } from '../lib/billing.js'
import { extractBillFromDataUrl } from '../lib/billExtract.js'
import { allowedSectionsForUser } from '../lib/sections.js'
import { assertSectionAccess, authenticate } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../middleware/error.js'

export const billsRouter = Router()
billsRouter.use(authenticate)

const PHONE_RE = /^[+]?[\d\s-]{7,15}$/
const SectionEnum = z.nativeEnum(Section)

const createBillSchema = z.object({
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  customerPhone: z.string().default(''),
  bookingDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  transport: z.string().optional(),
  transportTime: z.string().optional(),
  section: SectionEnum,
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        productName: z.string().min(1),
        quantity: z.number().nonnegative(),
        unit: z.string(),
        unitPrice: z.number().nonnegative(),
        glassSize: z.string().optional(),
        model: z.string().optional(),
        sqFt: z.number().optional(),
      }),
    )
    .min(1, 'A bill needs at least one item'),
  discount: z.number().nonnegative().optional(),
  paidAmount: z.number().nonnegative().optional(),
})

const extractSchema = z.object({
  // A base64 data URL of the bill — image/* or application/pdf.
  dataUrl: z.string().regex(/^data:[^;]+;base64,/, 'Expected a base64 data URL'),
})

/**
 * POST /api/bills/extract — read a scanned/uploaded bill (image or PDF) with an
 * LLM and return structured customer + line-item details. Does NOT create a bill;
 * the client reviews the result and submits POST /api/bills separately.
 */
billsRouter.post(
  '/extract',
  asyncHandler(async (req, res) => {
    const { dataUrl } = extractSchema.parse(req.body)
    const parsed = await extractBillFromDataUrl(dataUrl)
    res.json(parsed)
  }),
)

/**
 * POST /api/bills — create a sales bill.
 * Validates all stock up front (all-or-nothing), decrements inventory, and
 * writes the bill + items atomically.
 */
billsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createBillSchema.parse(req.body)
    assertSectionAccess(req.user!, input.section)

    if (input.customerPhone && !PHONE_RE.test(input.customerPhone)) {
      throw new ApiError(400, 'Invalid customer phone number')
    }

    const bill = await prisma.$transaction(async (tx) => {
      // 1. Validate stock for every item before touching anything.
      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) throw new ApiError(404, `Product ${item.productId} not found`)
        if (product.stock < item.quantity) {
          throw new ApiError(409, `Not enough stock for ${item.productName}`, {
            productName: item.productName,
            available: product.stock,
            requested: item.quantity,
          })
        }
      }

      // 2. Decrement stock.
      for (const item of input.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }

      // 3. Compute totals + next bill number, then create the bill.
      const items = input.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        glassSize: item.glassSize,
        model: item.model,
        sqFt: item.sqFt,
        unitPrice: item.unitPrice,
        subtotal: computeItemSubtotal(item),
      }))
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
      const discount = input.discount ?? 0
      const paidAmount = input.paidAmount ?? 0

      const agg = await tx.salesBill.aggregate({ _max: { billNumber: true } })
      const billNumber = (agg._max.billNumber ?? 0) + 1

      return tx.salesBill.create({
        data: {
          billNumber,
          customerName: input.customerName,
          customerAddress: input.customerAddress,
          customerPhone: input.customerPhone,
          bookingDate: input.bookingDate,
          deliveryDate: input.deliveryDate,
          transport: input.transport,
          transportTime: input.transportTime,
          section: input.section,
          subtotal,
          total: subtotal,
          discount,
          paidAmount,
          status: getBillStatus(subtotal, discount, paidAmount),
          createdBy: req.user!.id,
          items: { create: items },
        },
        include: { items: true },
      })
    })

    res.status(201).json(bill)
  }),
)

/**
 * GET /api/bills?from=&to=&section=&userId=
 * Always scoped to the requesting user's allowed sections.
 */
billsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const allowed = allowedSectionsForUser(req.user!)
    const querySchema = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      section: SectionEnum.optional(),
      userId: z.string().optional(),
    })
    const { from, to, section, userId } = querySchema.parse(req.query)

    if (section) assertSectionAccess(req.user!, section)

    const bills = await prisma.salesBill.findMany({
      where: {
        section: section ?? { in: allowed },
        ...(userId ? { createdBy: userId } : {}),
        ...(from && to ? { date: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      include: { items: true },
      orderBy: { date: 'desc' },
    })
    res.json(bills)
  }),
)

/** GET /api/bills/today?userId= */
billsRouter.get(
  '/today',
  asyncHandler(async (req, res) => {
    const allowed = allowedSectionsForUser(req.user!)
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined

    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)

    const bills = await prisma.salesBill.findMany({
      where: {
        section: { in: allowed },
        date: { gte: start, lte: end },
        ...(userId ? { createdBy: userId } : {}),
      },
      include: { items: true },
      orderBy: { date: 'desc' },
    })
    res.json(bills)
  }),
)

/** GET /api/bills/:id — single bill (must be in an allowed section). */
billsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const bill = await prisma.salesBill.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    })
    if (!bill) throw new ApiError(404, 'Bill not found')

    const allowed = allowedSectionsForUser(req.user!) as string[]
    if (!allowed.includes(bill.section)) throw new ApiError(403, 'No access to this bill')

    res.json(bill)
  }),
)
