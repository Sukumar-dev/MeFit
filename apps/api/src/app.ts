import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import loginRouter from './routes/login.js'
import usersRouter from './routes/users.js'
import profilesRouter from './routes/profiles.js'
import catalogRouter from './routes/catalog.js'
import goalsRouter from './routes/goals.js'
import contributorRouter from './routes/contributor.js'
import contributorRequestsRouter from './routes/contributor-requests.js'
import { logger } from './logger.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(cors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use((request, response, next) => {
    const startedAt = Date.now()
    response.once('finish', () => {
      logger.info({ method: request.method, path: request.path, statusCode: response.statusCode, durationMs: Date.now() - startedAt }, 'HTTP request')
    })
    next()
  })

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' })
  })

  app.get('/ready', async (_request, response) => {
    try {
      const { prisma } = await import('./db.js')
      if (['supabase', 'dual'].includes(process.env.AUTH_PROVIDER ?? '')) {
        await prisma.supabaseIdentity.findFirst({ select: { subject: true } })
      } else {
        await prisma.$queryRaw`SELECT 1`
      }
      response.status(200).json({ status: 'ready' })
    } catch (error) {
      logger.error({ err: error }, 'Readiness check failed')
      response.status(503).json({ status: 'not_ready' })
    }
  })


  app.use(loginRouter)
  app.use(usersRouter)
  app.use(profilesRouter)
  app.use(catalogRouter)
  app.use(goalsRouter)
  app.use(contributorRouter)
  app.use(contributorRequestsRouter)
  app.use('/api', loginRouter)
  app.use('/api', usersRouter)
  app.use('/api', profilesRouter)
  app.use('/api', catalogRouter)
  app.use('/api', goalsRouter)
  app.use('/api', contributorRouter)
  app.use('/api', contributorRequestsRouter)

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested endpoint was not found.' } })
  })

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    logger.error({ err: error }, 'Unhandled request error')
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } })
  })

  return app
}
