import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { User } from '@prisma/client'

import { env } from '../env.js'
import { allowedSectionsForUser, sectionsToProcess } from './sections.js'

export interface JwtPayload {
  sub: string // user id
  role: string
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signToken(user: Pick<User, 'id' | 'role'>): string {
  const payload: JwtPayload = { sub: user.id, role: user.role }
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  }
  return jwt.sign(payload, env.JWT_SECRET, options)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}

/** Public (password-free) shape sent to the client. */
export function toPublicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    label: user.label,
    initials: user.initials,
    avatarColor: user.avatarColor,
    active: user.active,
    process: sectionsToProcess(user.processes),
    sections: allowedSectionsForUser(user),
    createdAt: user.createdAt.toISOString(),
  }
}
