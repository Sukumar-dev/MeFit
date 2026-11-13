import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Activity, LogOut, ShieldCheck } from 'lucide-react'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { apiUrl } from './auth/api'
import { fullNameForUser } from './auth/session'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const CatalogPage = lazy(() => import('./pages/CatalogPage').then((module) => ({ default: module.CatalogPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((module) => ({ default: module.GoalsPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })))
const ContributorPage = lazy(() => import('./pages/ContributorPage').then((module) => ({ default: module.ContributorPage })))

function HomePage() {
  const { session, logout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [progress, setProgress] = useState<{ today: string; goal: { id: string; name: string; description: string; objective: string; status: string; start_date: string; end_date: string; total_workouts: number; completed_workouts: number; progress_percent: number; days_left: number; workouts: Array<{ id: string; name: string; type: string; completed_at: string | null }> } | null } | null>(null)
  const [progressError, setProgressError] = useState<string | null>(null)
  const accessToken = session?.accessToken
  const fullName = session ? fullNameForUser(session.user) : ''

  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    fetch(`${apiUrl}/goal/current`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: controller.signal })
      .then(async (response) => { const result = await response.json() as typeof progress; if (!response.ok || !result) throw new Error('Could not load this week’s progress.'); return result })
      .then(setProgress)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setProgressError(cause instanceof Error ? cause.message : 'Could not load this week’s progress.') })
    return () => controller.abort()
  }, [accessToken])

  if (!session) return <Navigate to="/login" replace />
  if (!session.user.hasProfile) return <Navigate to="/profile/setup" replace />

  async function signOut() {
    setSigningOut(true)
    await logout()
  }

  return (
    <main className="min-h-screen bg-[#f3f7f5] text-slate-900">
      <header className="border-b border-emerald-950/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-900 text-lime-200"><Activity size={19} /></span>MeFit</Link>
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <nav className="hidden items-center gap-3 text-sm font-semibold md:flex"><Link to="/catalog" className="text-slate-600 hover:text-emerald-900">Library</Link><Link to="/goals" className="text-slate-600 hover:text-emerald-900">Goals</Link>{session.user.roles.some((role) => role === 'CONTRIBUTOR' || role === 'ADMIN') && <Link to="/contribute" className="text-slate-600 hover:text-emerald-900">Contribute</Link>}{session.user.roles.some((role) => role === 'ADMIN') && <Link to="/admin" className="text-slate-600 hover:text-emerald-900">Admin</Link>}</nav>
            <div className="min-w-0 max-w-[min(42vw,14rem)] text-right sm:max-w-56"><p className="break-words text-xs font-semibold leading-4 sm:text-sm">{fullName || 'Your account'}</p><p className="break-all text-[10px] leading-4 text-slate-500 sm:text-xs">{session.user.email}</p></div>
            <button type="button" onClick={() => void signOut()} disabled={signingOut} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:gap-2 sm:px-3 sm:text-sm">
              <LogOut size={16} />{signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Your weekly workspace</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{fullName ? `Welcome, ${fullName}.` : 'Welcome!'}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">Your account is connected and your sign-in is protected by the identity provider.</p>
        </div>
        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="week-heading">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">This week</p><h2 id="week-heading" className="mt-2 text-2xl font-semibold">{progress?.goal?.name ?? 'Your plan and progress'}</h2>{progress?.goal?.description && <p className="mt-1 text-sm text-slate-600">{progress.goal.description}</p>}</div><Link to="/goals" className="text-sm font-semibold text-emerald-900 underline underline-offset-4">Manage goals</Link></div>
          {progressError ? <p className="mt-5 text-sm text-rose-700" role="alert">{progressError}</p> : !progress ? <p className="mt-5 text-sm text-slate-500" role="status">Loading weekly progress…</p> : !progress.goal ? <div className="mt-5 rounded-2xl bg-emerald-50 p-5"><p className="font-semibold">No active goal for today</p><p className="mt-1 text-sm leading-6 text-slate-600">Choose a start date and set up your first week.</p><Link to="/goals" className="mt-3 inline-flex text-sm font-semibold text-emerald-900 underline underline-offset-4">Create a weekly goal</Link></div> : <><div className="mt-5 grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, index) => { const day = new Date(`${progress.goal!.start_date}T12:00:00`); day.setDate(day.getDate() + index); const value = day.toISOString().slice(0, 10); const today = progress.today === value; return <div key={value} className={`rounded-xl p-2 text-center ${today ? 'bg-emerald-900 text-white' : 'bg-slate-50 text-slate-600'}`}><span className="block text-[10px] uppercase">{day.toLocaleDateString(undefined, { weekday: 'short' })}</span><span className="mt-1 block text-sm font-semibold">{day.getDate()}</span></div> })}</div><div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 text-sm"><span><strong>{progress.goal.completed_workouts}/{progress.goal.total_workouts}</strong> workouts completed</span><span><strong>{progress.goal.days_left}</strong> days left</span><span><strong>{progress.goal.start_date}</strong> start date</span></div><ul className="mt-5 grid gap-3 sm:grid-cols-2">{progress.goal.workouts.map((workout) => <li key={workout.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"><span><span className="block text-sm font-semibold">{workout.name}</span><span className="text-xs text-slate-500">{workout.type}</span></span><span className={`text-xs font-semibold ${workout.completed_at ? 'text-emerald-800' : 'text-slate-500'}`}>{workout.completed_at ? 'Complete' : 'Upcoming'}</span></li>)}</ul></>}</section>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Link to="/goals" className="rounded-2xl border border-emerald-200 bg-emerald-950 p-6 text-white shadow-sm transition hover:bg-emerald-900"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime-200">Weekly plan</p><h2 className="mt-3 text-xl font-semibold">Set your next goal</h2><p className="mt-2 text-sm leading-6 text-emerald-50/80">Choose sessions, select your dates, and track completions.</p><span className="mt-4 inline-block text-sm font-semibold text-lime-200 underline underline-offset-4">Plan a week</span></Link>
          <Link to="/catalog" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-emerald-300 hover:shadow-md"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Movement library</p><h2 className="mt-3 text-xl font-semibold">Explore programs and workouts</h2><p className="mt-2 text-sm leading-6 text-slate-600">Browse guided programs, sessions, and individual exercises.</p><span className="mt-4 inline-block text-sm font-semibold text-emerald-900 underline underline-offset-4">Open library</span></Link>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><ShieldCheck size={20} /></span><h2 className="text-lg font-semibold">Account security</h2></div>
            <p className="mt-4 leading-7 text-slate-600">Your session uses OpenID Connect authorization code flow with PKCE. Two-step verification is managed by your identity provider.</p>
            <p className="mt-4 text-sm font-medium text-emerald-800">Roles: {session.user.roles.join(', ') || 'USER'}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-50 text-lime-800"><Activity size={20} /></span><h2 className="text-lg font-semibold">Profile setup</h2></div>
            <p className="mt-4 leading-7 text-slate-600">Your fitness profile and readiness preferences are saved in your account.</p>
            <Link to="/profile/setup" className="mt-4 inline-flex text-sm font-semibold text-emerald-800 underline underline-offset-4">Review profile details</Link>
          </article>
        </div>
      </section>
    </main>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage initialFlow="register" />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/profile/setup" element={<ProfilePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/contribute" element={<ContributorPage />} />
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return <BrowserRouter><AuthProvider><Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">Loading MeFit…</main>}><AppRoutes /></Suspense></AuthProvider></BrowserRouter>
}

export default App
