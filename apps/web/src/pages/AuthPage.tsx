import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { prewarmKeycloakOnce } from '../auth/warmup'
import { beginMfaChallenge, getSupabaseClient, provisionApiUser, supabaseAuthConfigured, useSupabaseAuth, verifyMfaChallenge, type SupabaseMfaChallenge } from '../auth/supabase'
import { MfaStepForm } from '../auth/MfaStepForm'

export function AuthPage({ initialFlow = 'login' }: { initialFlow?: 'login' | 'register' }) {
  const [flow, setFlow] = useState<'login' | 'register'>(initialFlow)
  const [pending, setPending] = useState(false)
  const [waitingForServer, setWaitingForServer] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [mfaChallenge, setMfaChallenge] = useState<SupabaseMfaChallenge | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const signInButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusAfterCancel = useRef(false)
  const { session, setSession } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!useSupabaseAuth) prewarmKeycloakOnce()
    return () => controllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!pending) {
      if (restoreFocusAfterCancel.current) {
        signInButtonRef.current?.focus()
        restoreFocusAfterCancel.current = false
      }
      return
    }

    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [pending])

  useEffect(() => {
    if (!session) return
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    navigate(from, { replace: true })
  }, [location.state, navigate, session])

  async function continueToIdentityProvider() {
    if (controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller
    setPending(true)
    setWaitingForServer(false)
    setElapsedSeconds(0)
    setError(null)
    try {
      const { startSignIn } = await import('../auth/oidc')
      await startSignIn(flow, {
        signal: controller.signal,
        onWaiting: () => setWaitingForServer(true),
      })
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Sign-in could not be started. Please try again.')
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
      setPending(false)
      setWaitingForServer(false)
    }
  }

  async function submitSupabaseAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const auth = getSupabaseClient().auth
      if (flow === 'login') {
        const { data, error: signInError } = await auth.signInWithPassword({ email: email.trim(), password })
        if (signInError) throw signInError
        if (!data.session) throw new Error('Sign-in did not return a session. Please try again.')
        await finishSupabaseSignIn()
      } else {
        const { data, error: signUpError } = await auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { display_name: displayName.trim() },
          },
        })
        if (signUpError) throw signUpError
        if (data.session) {
          await finishSupabaseSignIn()
        } else {
          setNotice('Check your email for a confirmation link. Once confirmed, you can sign in to MeFit.')
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication could not be completed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function finishSupabaseSignIn() {
    const step = await beginMfaChallenge()
    if ('challenge' in step) {
      setMfaChallenge(step.challenge)
      return
    }
    // Use the session returned by the MFA assurance check, rather than the initial AAL1 token.
    setSession(await provisionApiUser(step.session))
    setMfaChallenge(null)
  }

  async function verifySupabaseMfa(code: string) {
    if (!mfaChallenge || pending) return
    setPending(true)
    setError(null)
    try {
      const verified = await verifyMfaChallenge(mfaChallenge, code)
      setSession(await provisionApiUser(verified))
      setMfaChallenge(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Two-step verification failed. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function sendPasswordReset() {
    if (!email.trim()) {
      setError('Enter your email address first, then choose password reset.')
      return
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const { error: resetError } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })
      if (resetError) throw resetError
      setNotice('If an account exists for that email, Supabase will send a password reset link.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password reset could not be started. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function cancelWarmup() {
    if (!controllerRef.current) return
    restoreFocusAfterCancel.current = true
    controllerRef.current.abort()
    controllerRef.current = null
    setPending(false)
    setWaitingForServer(false)
    setElapsedSeconds(0)
    setError(null)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f7f5] px-4 py-10 text-slate-900">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-emerald-950/10 md:grid-cols-[1.05fr_0.95fr]">
        <div className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-emerald-950 p-12 text-white md:flex">
          <div className="absolute -right-20 -top-16 h-80 w-80 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-lime-300/20 blur-3xl" />
          <div className="relative flex items-center gap-3 text-xl font-semibold"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-lime-300 text-emerald-950"><Activity size={21} /></span>MeFit</div>
          <div className="relative max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-lime-200">Small steps. Strong weeks.</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.08] tracking-tight">Make room for a healthier routine.</h1>
            <p className="mt-5 text-lg leading-8 text-emerald-50/75">Plan workouts that fit your week, then track each one as you go.</p>
          </div>
          <p className="relative flex items-center gap-2 text-sm text-emerald-50/80"><ShieldCheck size={17} />Your account is protected with two-step verification.</p>
        </div>

        <div className="flex min-h-[620px] flex-col justify-center px-7 py-12 sm:px-12 lg:px-16">
          <div className="mb-10 flex items-center gap-3 text-lg font-semibold md:hidden"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-900 text-lime-200"><Activity size={21} /></span>MeFit</div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{flow === 'login' ? 'Welcome back' : 'Start your routine'}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{resetMode ? 'Reset your password' : flow === 'login' ? 'Sign in to MeFit' : 'Create your MeFit account'}</h2>
          <p className="mt-3 leading-7 text-slate-600">{resetMode ? 'We’ll email you a secure password reset link.' : flow === 'login' ? 'Continue to your weekly plan and progress.' : 'Set up your account, then build a plan that works for you.'}</p>

          {!supabaseAuthConfigured && useSupabaseAuth && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="alert">Supabase sign-in is not configured yet. Please contact the site administrator.</div>}
          {error && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800" role="alert">{error}</div>}
          {notice && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900" role="status">{notice}</div>}

          {useSupabaseAuth && mfaChallenge ? <MfaStepForm challenge={mfaChallenge} busy={pending} error={error} onVerify={(code) => void verifySupabaseMfa(code)} /> : useSupabaseAuth ? <form onSubmit={(event) => { if (resetMode) { event.preventDefault(); void sendPasswordReset() } else void submitSupabaseAuth(event) }} className="mt-8 space-y-4">
            {flow === 'register' && !resetMode && <label className="block text-sm font-medium text-slate-700">Name<input autoComplete="name" required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" /></label>}
            <label className="block text-sm font-medium text-slate-700">Email<input autoComplete="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" /></label>
            {!resetMode && <label className="block text-sm font-medium text-slate-700">Password<input autoComplete={flow === 'login' ? 'current-password' : 'new-password'} type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" /></label>}
            <button type="submit" disabled={pending || !supabaseAuthConfigured} aria-busy={pending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-70">
              {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
              {pending ? 'Please wait…' : resetMode ? 'Send reset link' : flow === 'login' ? 'Sign in' : 'Create account'}
            </button>
            {flow === 'login' && <button type="button" onClick={() => { setResetMode(!resetMode); setError(null); setNotice(null) }} className="w-full text-center text-sm font-semibold text-emerald-900 underline underline-offset-4">{resetMode ? 'Back to sign in' : 'Forgot password?'}</button>}
          </form> : <button
            ref={signInButtonRef}
            type="button"
            onClick={() => void continueToIdentityProvider()}
            disabled={pending}
            aria-busy={pending}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-70"
          >
            {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            {pending ? (waitingForServer ? 'Waking sign-in server…' : 'Checking secure connection…') : error ? 'Try again' : flow === 'login' ? 'Continue to sign in' : 'Continue to registration'}
            {!pending && <ArrowRight size={18} />}
          </button>}
          {pending && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950" role="status" aria-live="polite" aria-atomic="true">
            {waitingForServer ? <>
              <p>Waking up the sign-in server. This can take up to 90 seconds on the first visit.</p>
              <p className="mt-1 text-xs text-emerald-800">{elapsedSeconds}s elapsed · checking again every few seconds (up to 150s).</p>
            </> : <p>Checking whether the sign-in server is ready…</p>}
            <button type="button" onClick={cancelWarmup} className="mt-2 font-semibold text-emerald-900 underline underline-offset-2">Cancel</button>
          </div>}
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">Sign-in and two-step verification are securely handled by the identity provider.</p>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            {flow === 'login' ? 'New to MeFit?' : 'Already have an account?'}{' '}
            <Link to={flow === 'login' ? '/register' : '/login'} aria-disabled={pending} tabIndex={pending ? -1 : undefined} onClick={(event) => { if (pending) { event.preventDefault(); return } setFlow(flow === 'login' ? 'register' : 'login'); setResetMode(false); setError(null); setNotice(null) }} className="font-semibold text-emerald-800 underline-offset-4 hover:underline">
              {flow === 'login' ? 'Create an account' : 'Sign in'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
