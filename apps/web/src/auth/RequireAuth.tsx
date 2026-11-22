import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { session, authReady } = useAuth()
  const location = useLocation()
  if (!authReady) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-600" role="status">Restoring your secure session…</main>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
