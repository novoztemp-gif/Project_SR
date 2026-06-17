import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../prisma.js'
import { signToken, toPublicUser, verifyPassword } from '../lib/auth.js'
import { authenticate } from '../middleware/auth.js'
import { ApiError, asyncHandler } from '../middleware/error.js'

export const authRouter = Router()

const loginSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(1),
})

/**
 * GET /api/auth/users
 * Public list of selectable login identities (active counters + admin),
 * without any password data. Powers the login screen cards.
 */
authRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { active: true },
      orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }],
    })
    res.json(users.map(toPublicUser))
  }),
)

/**
 * POST /api/auth/login  { userId, password }
 * Returns a JWT and the public user object.
 */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { userId, password } = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.active) {
      throw new ApiError(401, 'Invalid credentials')
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      throw new ApiError(401, 'Invalid credentials')
    }

    const token = signToken(user)
    res.json({ token, user: toPublicUser(user) })
  }),
)

/** GET /api/auth/me — current user from the Bearer token. */
authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(toPublicUser(req.user!))
  }),
)

/** POST /api/auth/change-password — the logged-in user updates their own password. */
const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
})

authRouter.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePwSchema.parse(req.body)
    const user = req.user!

    const ok = await verifyPassword(currentPassword, user.passwordHash)
    if (!ok) throw new ApiError(400, 'Current password is incorrect')

    const { hashPassword } = await import('../lib/auth.js')
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    })
    res.json({ ok: true })
  }),
)
