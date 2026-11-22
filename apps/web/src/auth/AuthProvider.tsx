import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { clearSession, readSession, storeSession, type AppSession } from './session'
import { apiUrl } from './api'
import { getSupabaseClient, matchesSupabaseAccount, supabaseAuthConfigured, toAppSession, useSupabaseAuth } from './supabase'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AppSession | null>(() => useSupabaseAuth ? null : readSession())
  const [authReady, setAuthReady] = useState(() => !useSupabaseAuth || !supabaseAuthConfigured)
  const sessionRef = useRef(useSupabaseAuth ? readSession() : session)

  useEffect(() => {
    if (!useSupabaseAuth || !supabaseAuthConfigured) return
    if (sessionRef.current?.authProvider !== 'supabase') {
      clearSession()
      sessionRef.current = null
      setSessionState(null)
    }
    let active = true
    const client = getSupabaseClient()
    void client.auth.getSession().then(({ data }) => {
      if (!active || !data.session || sessionRef.current?.authProvider !== 'supabase') return
      const restored = toAppSession(data.session, sessionRef.current)
      if (!matchesSupabaseAccount(sessionRef.current, data.session) || restored.assuranceLevel !== 'aal2') {
        clearSession()
        sessionRef.current = null
        setSessionState(null)
        return
      }
      sessionRef.current = restored
      storeSession(restored)
      setSessionState(restored)
    }).catch(() => {
      if (!active) return
      clearSession()
      sessionRef.current = null
      setSessionState(null)
    }).finally(() => {
      if (active) setAuthReady(true)
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => {
      if (!next) {
        clearSession()
        sessionRef.current = null
        setSessionState(null)
        return
      }
      // MFA events can arrive before the API has linked the account.
      if (sessionRef.current?.authProvider !== 'supabase') return
      const refreshed = toAppSession(next, sessionRef.current)
      if (!matchesSupabaseAccount(sessionRef.current, next) || refreshed.assuranceLevel !== 'aal2') {
        clearSession()
        sessionRef.current = null
        setSessionState(null)
        return
      }
      sessionRef.current = refreshed
      storeSession(refreshed)
      setSessionState(refreshed)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
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
      const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' })
      if (error) throw error
      clearSession()
      setSessionState(null)
      window.location.assign('/login')
      return
    }
    const { endSignInSession } = await import('./oidc')
    await endSignInSession()
  }, [])
  const value = useMemo<AuthContextValue>(() => ({ session, authReady, setSession, logout }), [session, authReady, setSession, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
