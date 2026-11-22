import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/AuthContext'
import { ThemePreference } from './components/ThemePreference'
import { EmptyState } from './components/FitnessDesign'
import { ImageCredits } from './pages/ImageCredits'
import { LandingPage } from './pages/LandingPage'
import { RequireAuth } from './auth/RequireAuth'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })))

const FitnessWorkspace = lazy(() => import('./pages/FitnessWorkspace').then((module) => ({ default: module.FitnessWorkspace })))

const ExerciseLibraryPage = lazy(() => import('./pages/ExerciseLibraryPage').then(({ ExerciseLibraryPage }) => ({ default: ExerciseLibraryPage })))

function StartPage() {
  const { session, authReady } = useAuth()
  if (!authReady) return <main className="grid min-h-screen place-items-center mf-page text-sm" role="status">Restoring your session…</main>
  if (!session) return <LandingPage />
  return <Navigate to="/home" replace />
}

function NotFoundPage() {
  return <main className="mf-page min-h-screen px-5 py-16"><h1 className="text-center text-3xl font-semibold">Page not found</h1><EmptyState title="This page is unavailable"><Link className="mf-button mf-button-primary" to="/">Back to MeFit</Link></EmptyState></main>
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
        <Route path="/home" element={<FitnessWorkspace />} />
        <Route path="/plan" element={<FitnessWorkspace />} />
        <Route path="/log" element={<FitnessWorkspace />} />
        <Route path="/progress" element={<FitnessWorkspace />} />
        <Route path="/profile" element={<FitnessWorkspace />} />
        <Route path="/exercises" element={<ExerciseLibraryPage />} />
        <Route path="/catalog" element={<Navigate to="/exercises" replace />} />
        <Route path="/goals" element={<Navigate to="/plan" replace />} />
        <Route path="/admin" element={<Navigate to="/profile" replace />} />
        <Route path="/contribute" element={<Navigate to="/profile" replace />} />
      </Route>
      <Route path="/" element={<StartPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function App() {
  return <BrowserRouter><AuthProvider><ThemePreference /><Suspense fallback={<main className="grid min-h-screen place-items-center mf-page text-sm">Loading MeFit…</main>}><AppRoutes /></Suspense></AuthProvider></BrowserRouter>
}

export default App
