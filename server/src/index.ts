import { createApp } from './app.js'
import { env } from './env.js'
import { prisma } from './prisma.js'

async function main() {
  // Fail fast if the database is unreachable.
  await prisma.$connect()

  const app = createApp()
  const server = app.listen(env.PORT, () => {
    console.log(`🚀 SR billing API listening on http://localhost:${env.PORT}`)
    console.log(`   CORS origin: ${env.CLIENT_ORIGIN}`)
  })

  const shutdown = async () => {
    console.log('\nShutting down…')
    server.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(async (err) => {
  console.error('Failed to start server:', err)
  await prisma.$disconnect()
  process.exit(1)
})
