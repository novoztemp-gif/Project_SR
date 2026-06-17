import cors from 'cors'
import express from 'express'

import { env } from './env.js'
import { authRouter } from './routes/auth.routes.js'
import { billsRouter } from './routes/bills.routes.js'
import { countersRouter } from './routes/counters.routes.js'
import { inventoryRouter } from './routes/inventory.routes.js'
import { purchasesRouter } from './routes/purchases.routes.js'
import { errorHandler, notFound } from './middleware/error.js'

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '10mb' })) // 10mb to accommodate base64 scan/receipt images

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'sr-billing-server' }))

  app.use('/api/auth', authRouter)
  app.use('/api/counters', countersRouter)
  app.use('/api/inventory', inventoryRouter)
  app.use('/api/bills', billsRouter)
  app.use('/api/purchases', purchasesRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
