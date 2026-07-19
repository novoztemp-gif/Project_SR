import { Router } from 'express'
import { z } from 'zod'
import { Section } from '@prisma/client'

import { prisma } from '../prisma.js'
import { allowedSectionsForUser } from '../lib/sections.js'
import { assertSectionAccess, authenticate, requireAdmin } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../middleware/error.js'

export const inventoryRouter = Router()
inventoryRouter.use(authenticate)

const SectionEnum = z.nativeEnum(Section)

// ─── Godowns ───────────────────────────────────────────────────────────────────

/** GET /api/inventory/godowns — every godown. */
inventoryRouter.get(
  '/godowns',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.godown.findMany({ orderBy: { id: 'asc' } }))
  }),
)

/** GET /api/inventory/godowns/by-section?section= — godowns holding stock in a section. */
inventoryRouter.get(
  '/godowns/by-section',
  asyncHandler(async (req, res) => {
    const section = SectionEnum.parse(req.query.section)
    assertSectionAccess(req.user!, section)
    const rows = await prisma.product.findMany({
      where: { section },
      select: { godownId: true },
      distinct: ['godownId'],
    })
    const ids = rows.map((r) => r.godownId)
    res.json(await prisma.godown.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }))
  }),
)

// ─── Products ────────────────────────────────────────────────────────────────────

/** GET /api/inventory/products?section=&godownId= — scoped to the user's sections. */
inventoryRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const allowed = allowedSectionsForUser(req.user!)
    const querySchema = z.object({
      section: SectionEnum.optional(),
      godownId: z.string().optional(),
    })
    const { section, godownId } = querySchema.parse(req.query)

    if (section) assertSectionAccess(req.user!, section)

    const products = await prisma.product.findMany({
      where: {
        section: section ?? { in: allowed },
        ...(godownId ? { godownId } : {}),
      },
      orderBy: { name: 'asc' },
    })
    res.json(products)
  }),
)

/** GET /api/inventory/products/search?q= — name/sku/spec search within allowed sections. */
inventoryRouter.get(
  '/products/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q ?? '').trim()
    const allowed = allowedSectionsForUser(req.user!)
    if (!q) return res.json([])

    const products = await prisma.product.findMany({
      where: {
        section: { in: allowed },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { spec: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: 50,
    })
    res.json(products)
  }),
)

const productDefinitionSchema = z.object({
  name: z.string().min(1),
  spec: z.string().optional(),
  sku: z.string().min(1),
  unit: z.string().min(1),
  salePrice: z.number().nonnegative(),
  section: SectionEnum,
  godownId: z.string().min(1),
  lowStockThreshold: z.number().nonnegative(),
})

// Create allows an optional opening stock (default 0). Used by the "quick-add
// from a scanned bill" flow so the new product has enough stock to be billed
// immediately; normal product creation still defaults to 0 (stock via purchases).
const createProductSchema = productDefinitionSchema.extend({
  openingStock: z.number().nonnegative().default(0),
})

/** POST /api/inventory/products — create a product definition (optional opening stock). */
inventoryRouter.post(
  '/products',
  asyncHandler(async (req, res) => {
    const data = createProductSchema.parse(req.body)
    assertSectionAccess(req.user!, data.section)

    const godown = await prisma.godown.findUnique({ where: { id: data.godownId } })
    if (!godown) throw new ApiError(400, 'Unknown godown')

    const product = await prisma.product.create({
      data: {
        name: data.name,
        spec: data.spec || null,
        sku: data.sku,
        unit: data.unit,
        hsnCode: '',
        taxRate: 18,
        section: data.section,
        godownId: data.godownId,
        stock: data.openingStock,
        costPrice: 0,
        salePrice: data.salePrice,
        lowStockThreshold: data.lowStockThreshold,
      },
    })
    res.status(201).json(product)
  }),
)

/** PUT /api/inventory/products/:id — update a product definition. */
inventoryRouter.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const data = productDefinitionSchema.parse(req.body)
    assertSectionAccess(req.user!, data.section)

    const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!existing) throw new ApiError(404, 'Product not found')

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        spec: data.spec || null,
        sku: data.sku,
        unit: data.unit,
        salePrice: data.salePrice,
        section: data.section,
        godownId: data.godownId,
        lowStockThreshold: data.lowStockThreshold,
      },
    })
    res.json(product)
  }),
)

/** DELETE /api/inventory/products/:id */
inventoryRouter.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    await prisma.product.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }),
)

// ─── Transfers ───────────────────────────────────────────────────────────────────

const transferSchema = z.object({
  productId: z.string().min(1),
  fromGodownId: z.string().min(1),
  toGodownId: z.string().min(1),
  qty: z.number().positive(),
})

/** POST /api/inventory/transfers — move a product between godowns + log it. */
inventoryRouter.post(
  '/transfers',
  asyncHandler(async (req, res) => {
    const data = transferSchema.parse(req.body)

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } })
      if (!product || product.godownId !== data.fromGodownId) {
        throw new ApiError(400, 'Product is not in the selected source godown.')
      }
      if (data.qty <= 0 || data.qty > product.stock) {
        throw new ApiError(400, 'Transfer quantity exceeds available stock.')
      }
      assertSectionAccess(req.user!, product.section)

      await tx.product.update({
        where: { id: product.id },
        data: { godownId: data.toGodownId },
      })

      return tx.transferLog.create({
        data: {
          productId: product.id,
          productName: product.name,
          fromGodownId: data.fromGodownId,
          toGodownId: data.toGodownId,
          qty: data.qty,
          transferredBy: req.user!.name,
        },
      })
    })

    res.status(201).json(result)
  }),
)

/** GET /api/inventory/transfers — full transfer log (admin only). */
inventoryRouter.get(
  '/transfers',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await prisma.transferLog.findMany({ orderBy: { transferredAt: 'desc' } }))
  }),
)
