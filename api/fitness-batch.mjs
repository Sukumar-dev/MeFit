import { createRemoteJWKSet, jwtVerify } from 'jose'
import { matchRoute } from '../server/fitness-contract.mjs'

let application
let jwks
function error(res, status, message) {
  return res.status(status).json({ error: { message } })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const url = new URL(req.url, 'http://localhost')
  const pathname = url.pathname.replace(/^\/fitness-api\//, '').replace(/\/$/, '')
  // Vercel appends the captured rewrite segment to the function query.
  if (url.searchParams.get('path') === pathname) url.searchParams.delete('path')
  const route = matchRoute(req.method, pathname)
  if (!route) return error(res, 404, 'The requested endpoint was not found.')
  if (route[2] === 'public') {
    if (url.search) return error(res, 400, 'Query parameters are not supported.')
    return res.status(200).json({ status: 'ok' })
  }
  const token = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '')?.[1]
  if (!token) return error(res, 401, 'Please sign in to continue.')

  const origin = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!origin) return error(res, 503, 'Authentication is temporarily unavailable.')
  const issuer = new URL('/auth/v1', origin).href
  try {
    jwks ??= createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'), { timeoutDuration: 5000 })
    const { payload } = await jwtVerify(token, jwks, {
      issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'], requiredClaims: ['exp', 'sub'], clockTolerance: 60,
    })
    if (payload.aal !== 'aal2') return error(res, 403, 'Complete two-step verification to continue.')
  } catch { return error(res, 401, 'Your sign-in could not be verified.') }

  if ([...url.searchParams.keys()].some((name) => !route[3] || name !== 'search')) {
    return error(res, 400, 'Only search requests accept query parameters.')
  }
  if (!process.env.SRS_DATABASE_URL) return error(res, 503, 'The fitness database is temporarily unavailable.')
  try {
    if (!application) {
      process.env.AUTH_PROVIDER = 'supabase'
      process.env.SUPABASE_URL = origin
      process.env.DATABASE_URL = process.env.SRS_DATABASE_URL
      process.env.API_PUBLIC_ORIGIN ??= process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'
      application = (await import('../apps/api/dist/src/app.js')).createApp()
    }
    const target = ['program', 'workout'].includes(pathname) && req.method === 'GET' ? pathname + 's' : pathname
    req.url = '/' + target + url.search
    // Express receives body data already parsed by the Vercel Node runtime.
    const originalSetHeader = res.setHeader.bind(res)
    res.setHeader = (name, value) => originalSetHeader(name, name.toLowerCase() === 'location' && typeof value === 'string'
      ? value.replace(/^(https?:\/\/[^/]+)?\/api\//, '/fitness-api/')
      : value)
    return application(req, res)
  } catch (cause) {
    console.error('Fitness API dispatch failed', { method: req.method, kind: cause instanceof Error ? cause.name : 'unknown' })
    if (!res.headersSent) return error(res, 500, 'An unexpected error occurred.')
    res.end()
  }
}
