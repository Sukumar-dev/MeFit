import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { clearSession, readSession, storeSession, type AppSession } from './session'
import { apiUrl } from './api'
import { getSupabaseClient, supabaseAuthConfigured, toAppSession, useSupabaseAuth } from './supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AppSession | null>(() => useSupabaseAuth ? null : readSession())
  const sessionRef = useRef(session)

  useEffect(() => {
    if (!useSupabaseAuth || !supabaseAuthConfigured) return
    if (sessionRef.current?.authProvider !== 'supabase') {
      clearSession()
      sessionRef.current = null
      setSessionState(null)
    }
    const client = getSupabaseClient()
    void client.auth.getSession().then(({ data }) => {
      if (!data.session) return
      const restored = toAppSession(data.session, sessionRef.current)
      if (restored.assuranceLevel !== 'aal2') {
        clearSession()
        sessionRef.current = null
        setSessionState(null)
        return
      }
      sessionRef.current = restored
      storeSession(restored)
      setSessionState(restored)
    }).catch(() => {
      clearSession()
      sessionRef.current = null
      setSessionState(null)
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      if (!next) {
        clearSession()
        setSessionState(null)
        return
      }
      const refreshed = toAppSession(next, sessionRef.current)
      if (refreshed.assuranceLevel !== 'aal2') {
        clearSession()
        sessionRef.current = null
        setSessionState(null)
        return
      }
      sessionRef.current = refreshed
      storeSession(refreshed)
      setSessionState(refreshed)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const accessToken = session?.accessToken
    if (!accessToken) return
    const controller = new AbortController()
    fetch(`${apiUrl.replace(/\/$/, '')}/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) return null
      return await response.json() as { display_name?: string | null; first_name?: string | null; last_name?: string | null }
    }).then((profile) => {
      if (!profile || controller.signal.aborted) return
      const current = sessionRef.current
      if (!current || current.accessToken !== accessToken) return
      const updated: AppSession = { ...current, user: { ...current.user, displayName: profile.display_name?.trim() ?? '', firstName: profile.first_name ?? undefined, lastName: profile.last_name ?? undefined } }
      sessionRef.current = updated
      storeSession(updated)
      setSessionState(updated)
    }).catch(() => { /* Keep the current session if a profile refresh is temporarily unavailable. */ })
    return () => controller.abort()
  }, [session?.accessToken])

  const setSession = useCallback((nextSession: AppSession) => {
    sessionRef.current = nextSession
    storeSession(nextSession)
    setSessionState(nextSession)
  }, [])
  const logout = useCallback(async () => {
    if (useSupabaseAuth && supabaseAuthConfigured) {
      const { error } = await getSupabaseClient().auth.signOut()
      if (error) throw error
      clearSession()
      setSessionState(null)
      window.location.assign('/login')
      return
    }
    const { endSignInSession } = await import('./oidc')
    await endSignInSession()
  }, [])
  const value = useMemo<AuthContextValue>(() => ({ session, setSession, logout }), [session, setSession, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
