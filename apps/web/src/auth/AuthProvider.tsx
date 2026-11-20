import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { readSession, storeSession, type AppSession } from './session'
import { apiUrl } from './api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AppSession | null>(() => readSession())

  useEffect(() => {
    if (!session?.accessToken) return
    const controller = new AbortController()
    fetch(`${apiUrl.replace(/\/$/, '')}/user`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return null
      return await response.json() as { display_name?: string | null; first_name?: string | null; last_name?: string | null }
    }).then((profile) => {
      if (!profile || controller.signal.aborted) return
      const updated: AppSession = { ...session, user: { ...session.user, displayName: profile.display_name?.trim() ?? '', firstName: profile.first_name ?? undefined, lastName: profile.last_name ?? undefined } }
      storeSession(updated)
      setSessionState(updated)
    }).catch(() => { /* Keep the current session if a profile refresh is temporarily unavailable. */ })
    return () => controller.abort()
  }, [session?.accessToken])

  const setSession = useCallback((nextSession: AppSession) => {
    storeSession(nextSession)
    setSessionState(nextSession)
  }, [])
  const logout = useCallback(async () => {
    const { endSignInSession } = await import('./oidc')
    await endSignInSession()
  }, [])
  const value = useMemo<AuthContextValue>(() => ({ session, setSession, logout }), [session, setSession, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
