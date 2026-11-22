import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../auth/api'
import { MfaStepForm } from '../auth/MfaStepForm'
import { accountLinkCallbackPath, finishLegacyAccountLink, startLegacyAccountLink } from '../auth/oidc'
import { beginMfaChallenge, getSupabaseClient, provisionApiUser, useSupabaseAuth, verifyMfaChallenge, type SupabaseMfaChallenge } from '../auth/supabase'

async function confirmedEmail(session: Session) {
  const { data, error } = await getSupabaseClient().auth.getUser(session.access_token)
  if (error || data.user?.id !== session.user.id || !data.user.email_confirmed_at || !data.user.email) {
    throw new Error('Confirm the email address on your new MeFit sign-in before linking.')
  }
  return data.user.email
}

export function AccountLinkPage() {
  if (!useSupabaseAuth) return <Navigate to="/login" replace />
  return <SupabaseAccountLink />
}

function SupabaseAccountLink() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const started = useRef(false)
  const { current: callbackUrl } = useRef(pathname === accountLinkCallbackPath ? window.location.href : undefined)
  const [email, setEmail] = useState<string>()
  const [challenge, setChallenge] = useState<SupabaseMfaChallenge>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (callbackUrl) window.history.replaceState(window.history.state, '', accountLinkCallbackPath)
    void (async () => {
      const step = await beginMfaChallenge()
      if ('challenge' in step) {
        if (callbackUrl) throw new Error('Complete two-step verification and start the link again.')
        setChallenge(step.challenge)
        return
      }
      setEmail(await confirmedEmail(step.session))
      if (!callbackUrl) return
      const legacyToken = await finishLegacyAccountLink(callbackUrl, step.session.user.id)
      const current = await beginMfaChallenge()
      if ('challenge' in current || current.session.user.id !== step.session.user.id) {
        throw new Error('Your sign-in changed. Start the account link again.')
      }
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/user/link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${current.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ legacy_access_token: legacyToken }),
        signal: AbortSignal.timeout(90_000),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: { message?: string } } | null
        throw new Error(result?.error?.message ?? 'We could not link your accounts. Please try again.')
      }
      const session = await provisionApiUser(current.session)
      setSession(session)
      navigate(session.user.hasProfile ? '/' : '/profile/setup', { replace: true })
    })().catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'We could not link your accounts. Please try again.')
    }).finally(() => setBusy(false))
  }, [callbackUrl, navigate, setSession])

  async function verify(code: string) {
    if (!challenge || busy) return
    setBusy(true)
    setError(undefined)
    try {
      const session = await verifyMfaChallenge(challenge, code)
      setChallenge(undefined)
      setEmail(await confirmedEmail(session))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check your authenticator code and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function connect() {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      const step = await beginMfaChallenge()
      if ('challenge' in step) {
        setEmail(undefined)
        setChallenge(step.challenge)
        return
      }
      const verifiedEmail = await confirmedEmail(step.session)
      if (verifiedEmail !== email) {
        setEmail(verifiedEmail)
        throw new Error('Your signed-in email changed. Review it and try again.')
      }
      await startLegacyAccountLink(step.session.user.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The existing MeFit sign-in could not be started.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Link your existing MeFit account</h1>
        <p className="mt-3 leading-6 text-slate-600">Use the confirmed email on your existing MeFit account. Complete two-step verification, then sign in with your original MeFit credentials on the Keycloak sign-in screen.</p>
        {email && <p className="mt-4 break-words text-sm text-slate-700">Confirmed email <strong>{email}</strong></p>}
        {error && <p className="mt-4 text-sm text-rose-700" role="alert">{error}</p>}
        {challenge && <MfaStepForm challenge={challenge} busy={busy} onVerify={(code) => void verify(code)} />}
        {busy && !challenge && <p className="mt-4 text-sm text-slate-600" role="status">{callbackUrl ? 'Connecting your account…' : 'Checking your sign-in…'}</p>}
        {!callbackUrl && email && !challenge && <button type="button" disabled={busy} onClick={() => void connect()} className="mt-5 min-h-11 w-full rounded-lg bg-emerald-900 px-4 font-semibold text-white disabled:opacity-60">Sign in to existing MeFit</button>}
        {callbackUrl && error && <a href="/auth/link" className="mt-5 block font-semibold text-emerald-900 underline">Start account linking again</a>}
        <Link to="/login" className="mt-5 block text-sm font-semibold text-emerald-900 underline">Return to sign in</Link>
      </section>
    </main>
  )
}
