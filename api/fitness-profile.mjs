import { createRemoteJWKSet, jwtVerify } from 'jose'
import { z } from 'zod'

const profile = z.object({
  display_name: z.string().trim().min(1).max(120),
  avatar_url: z.string().url().startsWith('https://').nullable(),
  height_cm: z.number().min(80).max(250).nullable(),
  weight_kg: z.number().min(25).max(350).nullable(),
  timezone: z.string().min(1).max(80).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
  }),
  days_available: z.number().int().min(1).max(7),
  minutes_per_workout: z.number().int().min(5).max(180),
  current_activity: z.enum(['sedentary', 'light', 'moderate', 'high']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
}).strict()

const origin = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const issuer = origin ? new URL('/auth/v1', origin).href : undefined
const jwks = issuer && createRemoteJWKSet(new URL(issuer + '/.well-known/jwks.json'), { timeoutDuration: 5000 })

export function createProfileHandler({ verify, fetchProfile }) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store')
    const fail = (status, message) => res.status(status).json({ error: { message } })
    const token = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '')?.[1]
    if (!token) return fail(401, 'Please sign in to continue.')
    let claims
    try { claims = await verify(token) } catch { return fail(401, 'Your sign-in could not be verified.') }
    if (!claims.sub || !z.string().uuid().safeParse(claims.sub).success) return fail(401, 'Your sign-in could not be verified.')
    if (claims.aal !== 'aal2') return fail(403, 'Complete two-step verification to continue.')
    if (new URL(req.url, 'http://localhost').search) return fail(400, 'Query parameters are not supported.')
    if (!['GET', 'PUT'].includes(req.method)) {
      res.setHeader('Allow', 'GET, PUT')
      return fail(405, 'This method is not supported.')
    }
    const parsed = req.method === 'PUT' ? profile.safeParse(req.body) : null
    if (parsed && !parsed.success) return fail(400, 'Check your profile details and try again.')
    try {
      const rows = await fetchProfile(claims.sub, token, parsed?.data)
      return res.status(200).json(rows[0] ?? null)
    } catch { return fail(502, 'Your profile could not be loaded or saved. Please try again.') }
  }
}

export default createProfileHandler({
  verify: async (token) => {
    if (!jwks) throw new Error('Missing Supabase configuration')
    const { payload } = await jwtVerify(token, jwks, {
      issuer, audience: 'authenticated', algorithms: ['ES256', 'RS256'], requiredClaims: ['exp', 'sub'], clockTolerance: 60,
    })
    return payload
  },
  fetchProfile: async (subject, token, values) => {
    if (!origin || !key) throw new Error('Missing Supabase configuration')
    const url = new URL('/rest/v1/profiles', origin)
    const headers = { apikey: key, Authorization: 'Bearer ' + token, Accept: 'application/json' }
    if (values) {
      headers['Content-Type'] = 'application/json'
      headers.Prefer = 'resolution=merge-duplicates,return=representation'
    } else url.searchParams.set('id', 'eq.' + subject)
    const response = await fetch(url, {
      method: values ? 'POST' : 'GET',
      headers,
      body: values ? JSON.stringify({ ...values, id: subject }) : undefined,
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error('Profile data request failed')
    return response.json()
  },
})
