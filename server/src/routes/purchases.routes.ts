import { Router } from 'express'
import { z } from 'zod'
import { Section } from '@prisma/client'

import { prisma } from '../prisma.js'
import { allowedSectionsForUser } from '../lib/sections.js'
import { assertSectionAccess, authenticate } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../middleware/error.js'

export const purchasesRouter = Router()
purchasesRouter.use(authenticate)

const SectionEnum = z.nativeEnum(Section)

const createPurchaseSchema = z.object({
  vendorName: z.string().min(1),
  date: z.string().min(1),
  section: SectionEnum,
  godownId: z.string().min(1),
  imageUrl: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().default(''),
        productName: z.string().min(1),
        sizeDimension: z.string().optional(),
        quantity: z.number().positive(),
        unit: z.string().min(1),
        unitPrice: z.number().nonnegative(),
      }),
    )
    .min(1, 'A purchase needs at least one item'),
})

/** Computes the next voucher number, e.g. PUR-2026-0006. */
async function nextVoucherNumber(date: Date): Promise<string> {
  const rows = await prisma.purchaseBill.findMany({ select: { voucherNumber: true } })
  const maxSeq = rows.reduce((max, { voucherNumber }) => {
    const seq = Number(voucherNumber.match(/(\d+)$/)?.[1] ?? 0)
    return seq > max ? seq : max
  }, 0)
  return `PUR-${date.getFullYear()}-${String(maxSeq + 1).padStart(4, '0')}`
}

/** GET /api/purchases — purchases in the user's allowed sections. */
purchasesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const allowed = allowedSectionsForUser(req.user!)
    const purchases = await prisma.purchaseBill.findMany({
      where: { section: { in: allowed } },
      include: { items: true },
      orderBy: { date: 'desc' },
    })
    res.json(purchases)
  }),
)

/** POST /api/purchases — create a purchase (stock stays pending until printed). */
purchasesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createPurchaseSchema.parse(req.body)
    assertSectionAccess(req.user!, input.section)

    const date = new Date(input.date)
    const items = input.items.map((item) => ({
      productId: item.productId ?? '',
      productName: item.productName,
      sizeDimension: item.sizeDimension,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      subtotal: item.quantity * item.unitPrice,
    }))
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)

    const purchase = await prisma.purchaseBill.create({
      data: {
        voucherNumber: await nextVoucherNumber(date),
        vendorName: input.vendorName,
        date,
        section: input.section,
        godownId: input.godownId,
        imageUrl: input.imageUrl,
        subtotal,
        total: subtotal,
        createdBy: req.user!.id,
        printedAt: null,
        items: { create: items },
      },
      include: { items: true },
    })
    res.status(201).json(purchase)
  }),
)

/** GET /api/purchases/:id */
purchasesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const purchase = await prisma.purchaseBill.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    })
    if (!purchase) throw new ApiError(404, 'Purchase not found')

    const allowed = allowedSectionsForUser(req.user!) as string[]
    if (!allowed.includes(purchase.section)) throw new ApiError(403, 'No access to this purchase')

    res.json(purchase)
  }),
)

/**
 * POST /api/purchases/:id/apply-print
 * Commits the purchase to inventory (increment existing products / create new
 * ones) and stamps printedAt. Idempotent — a second call is a no-op reprint.
 */
purchasesRouter.post(
  '/:id/apply-print',
  asyncHandler(async (req, res) => {
    const updated = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchaseBill.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      })
      if (!purchase) throw new ApiError(404, 'Purchase not found')

      const allowed = allowedSectionsForUser(req.user!) as string[]
      if (!allowed.includes(purchase.section)) throw new ApiError(403, 'No access to this purchase')

      // Already printed → reprint only, do not re-apply stock.
      if (purchase.printedAt) return purchase

      for (const item of purchase.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          })
        } else {
          await tx.product.create({
            data: {
              name: item.productName,
              sku: `NEW-${Date.now()}-${Math.round(item.unitPrice)}`,
              unit: item.unit,
              hsnCode: '',
              taxRate: 18,
              section: purchase.section,
              godownId: purchase.godownId,
              stock: item.quantity,
              costPrice: item.unitPrice,
              salePrice: item.unitPrice,
              lowStockThreshold: 5,
            },
          })
        }
      }

      return tx.purchaseBill.update({
        where: { id: purchase.id },
        data: { printedAt: new Date() },
        include: { items: true },
      })
    })

    res.json(updated)
  }),
)
