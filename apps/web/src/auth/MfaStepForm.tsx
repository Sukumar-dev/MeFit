import { useState, type FormEvent } from 'react'
import type { SupabaseMfaChallenge } from './supabase'

export function MfaStepForm({ challenge, busy = false, error, onVerify }: {
  challenge: SupabaseMfaChallenge
  busy?: boolean
  error?: string | null
  onVerify: (code: string) => void
}) {
  const [code, setCode] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onVerify(code)
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 text-left" aria-label="Two-step verification">
      {challenge.setup && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <h3 className="font-semibold text-emerald-950">Set up your authenticator</h3>
        <p className="mt-1 text-sm leading-6 text-emerald-900">Scan this code with an authenticator app, then enter its current 6-digit code.</p>
        <img className="mx-auto mt-3 h-40 w-40 rounded-lg bg-white p-2" src={challenge.setup.qrCode} alt="Authenticator setup QR code" />
        <p className="mt-2 text-xs text-emerald-900">If you cannot scan, enter this setup key manually:</p>
        <code className="mt-1 block break-all rounded bg-white p-2 text-sm font-semibold text-slate-900">{challenge.setup.secret}</code>
      </div>}
      {!challenge.setup && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">Enter the current code from your authenticator app to finish signing in.</div>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <label className="block text-sm font-medium text-slate-700">Authenticator code<input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-center text-lg tracking-[0.3em] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20" /></label>
      <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white disabled:opacity-70">{busy ? 'Verifying…' : 'Verify and continue'}</button>
    </form>
  )
}
