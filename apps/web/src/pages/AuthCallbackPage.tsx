import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { AppSession } from '../auth/session'
import { AccountLinkRequiredError, beginMfaChallenge, completeSupabaseCallback, confirmSupabaseSignup, getSupabaseClient, provisionApiUser, useSupabaseAuth, verifyMfaChallenge, type SupabaseMfaChallenge } from '../auth/supabase'
import { MfaStepForm } from '../auth/MfaStepForm'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const completed = useRef(false)
  const [confirmationToken, setConfirmationToken] = useState(() =>
    useSupabaseAuth ? new URLSearchParams(window.location.hash.slice(1)).get('token_hash') : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [password, setPassword] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<SupabaseMfaChallenge | null>(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { session, setSession } = useAuth()
  const recoveryMode = useSupabaseAuth && new URLSearchParams(window.location.search).get('type') === 'recovery'

  useEffect(() => {
    if (confirmationToken) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
      return
    }
    if (completed.current) return
    completed.current = true
    if (recoveryMode) {
      const code = new URLSearchParams(window.location.search).get('code')
      const exchange = code ? getSupabaseClient().auth.exchangeCodeForSession(code) : Promise.resolve({ error: null })
      void exchange.then(({ error: exchangeError }) => {
        if (exchangeError) throw exchangeError
        return getSupabaseClient().auth.getSession()
      }).then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError
        if (!data.session) throw new Error('The password reset session has expired. Request a new reset link.')
        setRecoveryReady(true)
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'The password reset link could not be verified.'))
      return
    }
    const completion = useSupabaseAuth
      ? completeSupabaseCallback()
      : import('../auth/oidc').then(({ finishSignIn }) => finishSignIn())
    void completion
      .then(async (result) => {
        if (useSupabaseAuth) {
          const step = await beginMfaChallenge()
          if ('challenge' in step) {
            setMfaChallenge(step.challenge)
            return
          }
          setSession(await provisionApiUser(step.session))
        } else {
          setSession(result as AppSession)
        }
        window.history.replaceState({}, document.title, '/')
      })
      .catch((cause: unknown) => {
        if (cause instanceof AccountLinkRequiredError) navigate('/auth/link', { replace: true })
        else setError(cause instanceof Error ? cause.message : 'Sign-in could not be completed. Please try again.')
      })
  }, [confirmationToken, navigate, recoveryMode, setSession])

  async function confirmEmail() {
    if (!confirmationToken || pending) return
    setPending(true)
    setError(null)
    completed.current = true
    try {
      await confirmSupabaseSignup(confirmationToken)
      const step = await beginMfaChallenge()
      if ('challenge' in step) setMfaChallenge(step.challenge)
      else setSession(await provisionApiUser(step.session))
    } catch (cause) {
      if (cause instanceof AccountLinkRequiredError) navigate('/auth/link', { replace: true })
      else setError(cause instanceof Error ? cause.message : 'Email confirmation could not be completed.')
    } finally {
      setConfirmationToken(null)
      setPending(false)
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const { error: updateError } = await getSupabaseClient().auth.updateUser({ password })
      if (updateError) throw updateError
      await getSupabaseClient().auth.signOut()
      setNotice('Your password has been updated. Sign in again to complete two-step verification.')
      window.history.replaceState({}, document.title, '/login')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your password could not be updated. Please request a new reset link.')
    }
  }

  async function verifySupabaseMfa(code: string) {
    if (!mfaChallenge || pending) return
    setPending(true)
    setError(null)
    try {
      const verified = await verifyMfaChallenge(mfaChallenge, code)
      setSession(await provisionApiUser(verified))
      setMfaChallenge(null)
      window.history.replaceState({}, document.title, '/')
    } catch (cause) {
      if (cause instanceof AccountLinkRequiredError) navigate('/auth/link', { replace: true })
      else setError(cause instanceof Error ? cause.message : 'Two-step verification failed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (session && !recoveryMode && !confirmationToken && !mfaChallenge && !error) return <Navigate to="/" replace />

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-800">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" aria-live="polite">
        {(!recoveryMode || !recoveryReady) && !mfaChallenge && !confirmationToken && !error && <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-800" />}
        <h1 className="mt-5 text-xl font-semibold">{confirmationToken ? 'Confirm your email' : mfaChallenge ? (mfaChallenge.setup ? 'Set up two-step verification' : 'Two-step verification') : recoveryMode ? 'Choose a new password' : 'Finishing secure sign-in'}</h1>
        {notice && <p className="mt-3 leading-6 text-emerald-800" role="status">{notice} <a href="/login" className="font-semibold underline">Sign in</a></p>}
        {confirmationToken ? <button type="button" disabled={pending} onClick={() => void confirmEmail()} className="mt-4 min-h-11 w-full rounded-lg bg-emerald-900 px-4 font-semibold text-white">{pending ? 'Confirming…' : 'Confirm email and continue'}</button> : mfaChallenge ? <MfaStepForm challenge={mfaChallenge} busy={pending} error={error} onVerify={(code) => void verifySupabaseMfa(code)} /> : error ? <p className="mt-3 leading-6 text-rose-700" role="alert">{error} <a href="/login" className="font-semibold underline">Return to sign in</a></p> : recoveryMode ? recoveryReady ? <form onSubmit={(event) => void updatePassword(event)} className="mt-4 space-y-3"><label className="block text-left text-sm font-medium">New password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><button type="submit" className="min-h-11 w-full rounded-lg bg-emerald-900 px-4 font-semibold text-white">Update password</button></form> : <p className="mt-2 text-sm text-slate-600">Verifying your secure reset link…</p> : <p className="mt-2 text-sm text-slate-600">Your account is being prepared.</p>}
      </section>
    </main>
  )
}
