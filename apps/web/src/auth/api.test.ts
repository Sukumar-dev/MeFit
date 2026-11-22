import { afterEach, expect, it, vi } from 'vitest'
import { authenticatedRequest } from './api'
import type { AppSession } from './session'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('./supabase', () => ({ getProfileSession: refresh }))
const session = { authProvider: 'supabase', accessToken: 'fixture' } as AppSession
afterEach(() => { vi.unstubAllGlobals(); refresh.mockReset() })

it('retries a 401 exactly once with a refreshed token', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  vi.stubGlobal('fetch', fetch)
  refresh.mockResolvedValue({ ...session, accessToken: 'refreshed' })
  expect((await authenticatedRequest('/user', session, {}, '/fitness-api')).status).toBe(401)
  expect(refresh).toHaveBeenCalledExactlyOnceWith(session, true)
  expect(fetch.mock.calls.map((call) => call[1].headers.get('Authorization'))).toEqual(['Bearer fixture', 'Bearer refreshed'])
})

it('does not refresh when authorization is denied', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })))
  expect((await authenticatedRequest('/admin/users', session, {}, '/fitness-api')).status).toBe(403)
  expect(refresh).not.toHaveBeenCalled()
})
