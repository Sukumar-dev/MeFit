import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { startSignIn } from '../auth/oidc'

export function AuthPage({ initialFlow = 'login' }: { initialFlow?: 'login' | 'register' }) {
  const [flow, setFlow] = useState<'login' | 'register'>(initialFlow)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { session } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!session) return
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    navigate(from, { replace: true })
  }, [location.state, navigate, session])

  async function continueToIdentityProvider() {
    setPending(true)
    setError(null)
    try {
      await startSignIn(flow)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in could not be started. Please try again.')
      setPending(false)
    }
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
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{flow === 'login' ? 'Sign in to MeFit' : 'Create your MeFit account'}</h2>
          <p className="mt-3 leading-7 text-slate-600">{flow === 'login' ? 'Continue to your weekly plan and progress.' : 'Set up your account, then build a plan that works for you.'}</p>

          {error && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800" role="alert">{error}</div>}

          <button
            type="button"
            onClick={() => void continueToIdentityProvider()}
            disabled={pending}
            className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? 'Connecting securely…' : error ? 'Try again' : flow === 'login' ? 'Continue to sign in' : 'Continue to registration'}
            {!pending && <ArrowRight size={18} />}
          </button>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">Sign-in and two-step verification are securely handled by the identity provider.</p>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            {flow === 'login' ? 'New to MeFit?' : 'Already have an account?'}{' '}
            <Link to={flow === 'login' ? '/register' : '/login'} onClick={() => { setFlow(flow === 'login' ? 'register' : 'login'); setError(null) }} className="font-semibold text-emerald-800 underline-offset-4 hover:underline">
              {flow === 'login' ? 'Create an account' : 'Sign in'}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
