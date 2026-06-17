import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../prisma.js'
import { hashPassword, toPublicUser } from '../lib/auth.js'
import { processToSections } from '../lib/sections.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../middleware/error.js'
import { env } from '../env.js'

export const countersRouter = Router()

// All counter management is admin-only.
countersRouter.use(authenticate, requireAdmin)

const AVATAR_COLORS = ['deep', 'mint', 'leaf', 'forest', 'highlight', 'charcoal']

const SectionTypeEnum = z.enum(['Glass', 'Plywood', 'Plumbing', 'Painting', 'Electrical'])

const counterSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  process: z.array(SectionTypeEnum).min(1, 'Pick at least one process'),
  active: z.boolean().default(true),
  password: z.string().min(4).optional(),
})

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** GET /api/counters — all counters (active + inactive) for management. */
countersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const counters = await prisma.user.findMany({
      where: { role: { startsWith: 'billing_' } },
      orderBy: { sortOrder: 'asc' },
    })
    res.json(counters.map(toPublicUser))
  }),
)

/** POST /api/counters — create a new billing counter/user. */
countersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = counterSchema.parse(req.body)

    const count = await prisma.user.count({ where: { role: { startsWith: 'billing_' } } })
    const id = `billing_${randomUUID().replace(/-/g, '').slice(0, 4)}`
    const max = await prisma.user.aggregate({ _max: { sortOrder: true } })

    const counter = await prisma.user.create({
      data: {
        id,
        role: id,
        name: data.name,
        email: `${id}@hardwareco.local`,
        passwordHash: await hashPassword(data.password ?? env.SEED_COUNTER_PASSWORD),
        label: data.label,
        initials: initialsFromName(data.name),
        avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
        active: data.active,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        processes: processToSections(data.process),
      },
    })
    res.status(201).json(toPublicUser(counter))
  }),
)

/** PUT /api/counters/:id — update a counter's details. */
countersRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = counterSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!existing || !existing.role.startsWith('billing_')) {
      throw new ApiError(404, 'Counter not found')
    }

    const counter = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        label: data.label,
        initials: initialsFromName(data.name),
        active: data.active,
        processes: processToSections(data.process),
        ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
      },
    })
    res.json(toPublicUser(counter))
  }),
)

/** DELETE /api/counters/:id — soft-delete (deactivate) a counter. */
countersRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!existing || !existing.role.startsWith('billing_')) {
      throw new ApiError(404, 'Counter not found')
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { active: false } })
    res.json({ ok: true })
  }),
)

/** PUT /api/counters/reorder  { ids } — persist drag-drop order. */
const reorderSchema = z.object({ ids: z.array(z.string()).min(1) })

countersRouter.put(
  '/reorder/all',
  asyncHandler(async (req, res) => {
    const { ids } = reorderSchema.parse(req.body)
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.user.update({ where: { id }, data: { sortOrder: index } }),
      ),
    )
    res.json({ ok: true })
  }),
)
