import type { NextFunction, Request, Response } from 'express'
import type { User } from '@prisma/client'

import { prisma } from '../prisma.js'
import { verifyToken } from '../lib/auth.js'
import { allowedSectionsForUser } from '../lib/sections.js'
import { ApiError } from './error.js'

// Augment Express's Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

/** Verifies the Bearer token and loads the user onto req.user. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Missing or malformed Authorization header')
    }
    const token = header.slice('Bearer '.length).trim()

    let payload
    try {
      payload = verifyToken(token)
    } catch {
      throw new ApiError(401, 'Invalid or expired token')
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.active) {
      throw new ApiError(401, 'User no longer exists or is inactive')
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}

/** Requires the authenticated user to be an admin. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Admin access required'))
  }
  next()
}

/** Throws if the user cannot access the given section. */
export function assertSectionAccess(user: User, section: string) {
  const allowed = allowedSectionsForUser(user) as string[]
  if (!allowed.includes(section)) {
    throw new ApiError(403, `You do not have access to the ${section} section`)
  }
}
