import { PrismaClient } from '@prisma/client'

// Single shared PrismaClient for the process. Avoids exhausting the connection
// pool when the dev server hot-reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
