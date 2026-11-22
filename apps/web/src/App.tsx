import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/AuthContext'
import { ThemePreference } from './components/ThemePreference'
import { ImageCredits } from './pages/ImageCredits'
import { LandingPage } from './pages/LandingPage'
import { srsApiUrl } from './auth/api'
import { RequireAuth } from './auth/RequireAuth'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))

const FitnessWorkspace = lazy(() => import('./pages/FitnessWorkspace').then((module) => ({ default: module.FitnessWorkspace })))

const ExerciseLibraryPage = lazy(() => import('./pages/ExerciseLibraryPage').then(({ ExerciseLibraryPage }) => ({ default: ExerciseLibraryPage })))

const AdminPage = lazy(() => import('./pages/AdminPage').then(({ AdminPage }) => ({ default: AdminPage })))
const ContributorPage = lazy(() => import('./pages/ContributorPage').then(({ ContributorPage }) => ({ default: ContributorPage })))

function RolePage({ admin = false }: { admin?: boolean }) {
  const { session } = useAuth()
  const roles = session?.user.roles ?? []
  const allowed = roles.includes('ADMIN') || (!admin && roles.includes('CONTRIBUTOR'))
  if (!srsApiUrl || !allowed) return <Navigate to="/" replace />
  return admin ? <AdminPage /> : <ContributorPage />
}

const TrainingCatalogPage = lazy(() => import('./pages/TrainingCatalogPage').then(({ TrainingCatalogPage }) => ({ default: TrainingCatalogPage })))
const GoalsPage = lazy(() => import('./pages/GoalsPage').then(({ GoalsPage }) => ({ default: GoalsPage })))

function StartPage() {
  const { session, authReady } = useAuth()
  if (!authReady) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600" role="status">Restoring your session…</main>
  if (!session) return srsApiUrl ? <Navigate to="/login" replace /> : <LandingPage />
  return <FitnessWorkspace />
}

function NotFoundPage() {
  return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-3xl font-semibold">Page not found</h1><Link className="mt-5 inline-flex min-h-11 items-center text-emerald-900 underline" to="/">Back to MeFit</Link></main>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/credits" element={<ImageCredits />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage initialFlow="register" />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/link" element={<Navigate to="/login" replace />} />
      <Route path="/auth/link/callback" element={<Navigate to="/login" replace />} />
      <Route element={<RequireAuth />}>
        <Route path="/profile/setup" element={<ProfilePage />} />
        <Route path="/catalog" element={<ExerciseLibraryPage />} />
        <Route path="/exercises" element={<ExerciseLibraryPage />} />
        <Route path="/goals" element={srsApiUrl ? <GoalsPage /> : <Navigate to="/#planner" replace />} />
        <Route path="/programs/:id?" element={<TrainingCatalogPage mode="programs" />} />
        <Route path="/workouts/:id?" element={<TrainingCatalogPage mode="workouts" />} />
        <Route path="/admin" element={<RolePage admin />} />
        <Route path="/contribute" element={<RolePage />} />
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="/plan" element={<Navigate to="/#planner" replace />} />
      <Route path="/log" element={<Navigate to="/#logging" replace />} />
      <Route path="/progress" element={<Navigate to="/#progress" replace />} />
      <Route path="/profile" element={<Navigate to="/#settings" replace />} />
      <Route path="/" element={<StartPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function App() {
  return <BrowserRouter><AuthProvider><ThemePreference /><Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600">Loading MeFit…</main>}><AppRoutes /></Suspense></AuthProvider></BrowserRouter>
}

export default App
