import { Router } from 'express'
import { z } from 'zod'

import { prisma } from '../prisma.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/error.js'

export const adminRouter = Router()
adminRouter.use(authenticate, requireAdmin)

const resetSchema = z.object({
  // Requiring this exact literal (not just any truthy value) means a bug
  // elsewhere that accidentally POSTs an empty/malformed body here can't
  // trigger a wipe — only a request that was deliberately built for this
  // one action can ever reach the deletes below.
  confirm: z.literal('ERASE ALL DATA'),
})

/**
 * POST /api/admin/reset — Admin only. Wipes every bill, purchase, transfer
 * log entry, and product so the app looks freshly installed, WITHOUT
 * touching accounts (Users/counters) or Godowns — those are
 * infrastructure/configuration, not transactional data, and staff would
 * otherwise have to recreate logins and storage locations from scratch
 * just to start entering new data. Irreversible; wrapped in one
 * transaction so a failure partway through can't leave the app in a mixed
 * state (e.g. bills gone but products still present).
 */
adminRouter.post(
  '/reset',
  asyncHandler(async (req, res) => {
    resetSchema.parse(req.body)

    const result = await prisma.$transaction(async (tx) => {
      // SalesItem/PurchaseItem cascade with their parent bill/purchase.
      const bills = await tx.salesBill.deleteMany({})
      const purchases = await tx.purchaseBill.deleteMany({})
      const transfers = await tx.transferLog.deleteMany({})
      const products = await tx.product.deleteMany({})
      return {
        bills: bills.count,
        purchases: purchases.count,
        transfers: transfers.count,
        products: products.count,
      }
    })

    res.json({ ok: true, deleted: result })
  }),
)
