import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { finishSignIn } from '../auth/oidc'

export function AuthCallbackPage() {
  const completed = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const { session, setSession } = useAuth()

  useEffect(() => {
    if (completed.current) return
    completed.current = true
    finishSignIn()
      .then((nextSession) => {
        setSession(nextSession)
        window.history.replaceState({}, document.title, '/')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Sign-in could not be completed. Please try again.'))
  }, [setSession])

  if (session) return <Navigate to="/" replace />

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-800">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" aria-live="polite">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-800" />
        <h1 className="mt-5 text-xl font-semibold">Finishing secure sign-in</h1>
        {error ? <p className="mt-3 leading-6 text-rose-700" role="alert">{error} <a href="/login" className="font-semibold underline">Return to sign in</a></p> : <p className="mt-2 text-sm text-slate-600">Your account is being prepared.</p>}
      </section>
    </main>
  )
}
