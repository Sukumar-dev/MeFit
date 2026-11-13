import './env.js'
import { createApp } from './app.js'
import { logger } from './logger.js'

const port = Number(process.env.PORT ?? 4000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port')
const host = process.env.HOST ?? '0.0.0.0'

const server = createApp().listen(port, host, () => {
  logger.info({ port, host }, 'MeFit API listening')
})

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down API')
  server.close(async (error) => {
    if (error) logger.error({ err: error }, 'HTTP server shutdown failed')
    try {
      const { prisma } = await import('./db.js')
      await prisma.$disconnect()
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, 'Database disconnect failed')
    }
    process.exit(error ? 1 : 0)
  })
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
