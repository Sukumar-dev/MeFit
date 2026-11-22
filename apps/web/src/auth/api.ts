import type { AppSession } from './session'
import { getProfileSession } from './supabase'

// The public Vercel hostname forwards /api to Render on the same browser origin.
export const apiUrl = globalThis.location?.hostname === 'mefit-fitness-planner.vercel.app'
  ? '/api'
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api')

// Enable the compatibility API only in environments that have its database configured.
export const srsApiUrl = import.meta.env.VITE_SRS_API_URL?.replace(/\/$/, '') as string | undefined



export async function authenticatedRequest(path: string, session: AppSession, options: RequestInit = {}, base = srsApiUrl ?? apiUrl): Promise<Response> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API request.')
  const send = (accessToken: string) => {
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    headers.set('Accept', 'application/json')
    return fetch(base + path, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(15000) })
  }
  const response = await send(session.accessToken)
  if (response.status !== 401 || session.authProvider !== 'supabase') return response
  const refreshed = await getProfileSession(session, true)
  return send(refreshed.accessToken)
}
