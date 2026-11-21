import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../auth/api'
import { useSupabaseAuth } from '../auth/supabase'

type Evaluation = { score: number; fitness_level: string; suitability_warning: string | null; note: string }

export function ProfilePage() {
  const { session, setSession } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(Boolean(session?.user.hasProfile))
  const [form, setForm] = useState({ display_name: session?.user.displayName ?? '', profile_image_url: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', height_cm: '', weight_kg: '', days_available: '3', minutes_per_session: '30', activity_level: 'light', experience: 'beginner', limitations: false, line1: '', city: '', country: '' })

  useEffect(() => {
    if (!session?.user.hasProfile) return
    const controller = new AbortController()
    fetch(`${apiUrl}/profile`, { headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' }, signal: controller.signal })
      .then(async (response) => { const result = await response.json() as { profile_image_url?: string | null; timezone?: string; height_cm?: number | string | null; weight_kg?: number | string | null; activity_level?: string; fitness_experience?: string; readiness?: { days_available?: number; minutes_per_session?: number; activity_level?: string; experience?: string; limitations?: boolean; evaluation?: Evaluation }; address?: { line1?: string; city?: string; country?: string } | null; error?: { message?: string } }; if (!response.ok) throw new Error(result.error?.message ?? 'Your profile could not be loaded.'); return result })
      .then((result) => setForm((previous) => ({ ...previous, profile_image_url: result.profile_image_url ?? '', timezone: result.timezone ?? previous.timezone, height_cm: result.height_cm == null ? '' : String(result.height_cm), weight_kg: result.weight_kg == null ? '' : String(result.weight_kg), activity_level: result.readiness?.activity_level ?? result.activity_level ?? previous.activity_level, experience: result.readiness?.experience ?? result.fitness_experience ?? previous.experience, days_available: result.readiness?.days_available == null ? previous.days_available : String(result.readiness.days_available), minutes_per_session: result.readiness?.minutes_per_session == null ? previous.minutes_per_session : String(result.readiness.minutes_per_session), limitations: result.readiness?.limitations ?? false, line1: result.address?.line1 ?? '', city: result.address?.city ?? '', country: result.address?.country ?? '' })))
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Your profile could not be loaded.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingProfile(false) })
    return () => controller.abort()
  }, [session?.accessToken, session?.user.hasProfile])

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          timezone: form.timezone,
          profile_image_url: form.profile_image_url || null,
          height_cm: form.height_cm ? Number(form.height_cm) : null,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          activity_level: form.activity_level,
          fitness_experience: form.experience,
          readiness: { days_available: Number(form.days_available), minutes_per_session: Number(form.minutes_per_session), activity_level: form.activity_level, experience: form.experience, limitations: form.limitations },
          ...(form.line1 && form.city && form.country ? { address: { line1: form.line1, city: form.city, country: form.country } } : {}),
        }),
        signal: AbortSignal.timeout(7000),
      })
      const result = await response.json() as { evaluation?: Evaluation; error?: { message?: string } }
      if (!response.ok || !result.evaluation) throw new Error(result.error?.message ?? 'Your profile could not be saved. Please try again.')
      const nameResponse = await fetch(`${apiUrl.replace(/\/$/, '')}/user/${session.user.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ display_name: form.display_name }) })
      if (!nameResponse.ok) throw new Error('Fitness details were saved, but your display name could not be updated.')
      setEvaluation(result.evaluation)
      setSession({ ...session, user: { ...session.user, displayName: form.display_name, hasProfile: true } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your profile could not be saved. Please try again.')
    } finally { setPending(false) }
  }

  async function deleteProfile() {
    if (!session || !window.confirm('Delete your fitness profile? Your saved goals and completion history will stay in your account.')) return
    setPending(true); setError(null)
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/profile`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } })
      if (!response.ok) { const result = await response.json() as { error?: { message?: string } }; throw new Error(result.error?.message ?? 'The fitness profile could not be deleted.') }
      setSession({ ...session, user: { ...session.user, hasProfile: false } })
      navigate('/', { replace: true })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The fitness profile could not be deleted.') }
    finally { setPending(false) }
  }

  const fieldClass = 'mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10'
  const labelClass = 'block text-sm font-medium text-slate-700'
  const showContributorRequest = session?.user.hasProfile && !session.user.roles.some((role) => role === 'CONTRIBUTOR' || role === 'ADMIN')

  return (
    <main className="min-h-screen bg-[#f3f7f5] px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 hover:underline"><ArrowLeft size={16} />Back to MeFit</Link>
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-900"><Activity /></span><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Your starting point</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Set up your fitness profile</h1><p className="mt-2 leading-6 text-slate-600">Tell us what fits your week. You can update these details later.</p></div></div>
          {evaluation ? <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" role="status"><div className="flex items-center gap-2 font-semibold text-emerald-950"><CheckCircle2 size={19} />Profile saved · {evaluation.fitness_level.toLowerCase()}</div><p className="mt-2 text-sm leading-6 text-emerald-900">Readiness score {evaluation.score}/100. {evaluation.note}</p>{evaluation.suitability_warning && <p className="mt-2 text-sm leading-6 text-amber-900">{evaluation.suitability_warning}</p>}<button type="button" onClick={() => navigate('/', { replace: true })} className="mt-4 min-h-11 rounded-xl bg-emerald-900 px-5 font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Request Contributions</button></div> : loadingProfile ? <div className="mt-8 rounded-xl bg-slate-50 p-6 text-sm text-slate-600" role="status">Loading your saved profile…</div> : <form onSubmit={(event) => void save(event)} className="mt-8 space-y-8">
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{error}</div>}
            <fieldset><legend className="text-base font-semibold">Account and profile</legend><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Display name<input required minLength={1} maxLength={120} className={fieldClass} value={form.display_name} onChange={(event) => update('display_name', event.target.value)} /></label><label className={labelClass}>Profile image URL (HTTPS)<input type="url" className={fieldClass} value={form.profile_image_url} onChange={(event) => update('profile_image_url', event.target.value)} placeholder="https://…" /></label></div><p className="mt-3 text-sm text-slate-600">Email and password are managed securely by your identity provider.{useSupabaseAuth ? ' Use the password reset option on the sign-in page if you need to change your password.' : <> <a className="font-semibold text-emerald-900 underline underline-offset-4" href={`${import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/mefit'}/account/#/personal-info`} target="_blank" rel="noreferrer">Manage sign-in details</a></>}</p><p className="mt-4 text-sm font-semibold">Physical details <span className="font-normal text-slate-500">(optional)</span></p><div className="mt-3 grid gap-4 sm:grid-cols-3"><label className={labelClass}>Height (cm)<input className={fieldClass} type="number" min="80" max="250" step="0.1" value={form.height_cm} onChange={(event) => update('height_cm', event.target.value)} /></label><label className={labelClass}>Weight (kg)<input className={fieldClass} type="number" min="25" max="350" step="0.1" value={form.weight_kg} onChange={(event) => update('weight_kg', event.target.value)} /></label><label className={labelClass}>Time zone<input required className={fieldClass} value={form.timezone} onChange={(event) => update('timezone', event.target.value)} /></label></div></fieldset>
            <fieldset><legend className="text-base font-semibold">Your weekly readiness</legend><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className={labelClass}>Days available<input required className={fieldClass} type="number" min="1" max="7" value={form.days_available} onChange={(event) => update('days_available', event.target.value)} /></label><label className={labelClass}>Minutes per workout<input required className={fieldClass} type="number" min="10" max="180" step="5" value={form.minutes_per_session} onChange={(event) => update('minutes_per_session', event.target.value)} /></label><label className={labelClass}>Current activity<select className={fieldClass} value={form.activity_level} onChange={(event) => update('activity_level', event.target.value)}><option value="sedentary">Mostly sitting</option><option value="light">Light activity</option><option value="moderate">Moderately active</option><option value="high">Very active</option></select></label><label className={labelClass}>Workout experience<select className={fieldClass} value={form.experience} onChange={(event) => update('experience', event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div><label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><input type="checkbox" className="mt-1 accent-emerald-800" checked={form.limitations} onChange={(event) => update('limitations', event.target.checked)} /><span>I have an injury, health concern, or movement limitation to keep in mind. MeFit will show a suitability reminder.</span></label></fieldset>
            <fieldset><legend className="text-base font-semibold">Address <span className="font-normal text-slate-500">(optional)</span></legend><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className={`${labelClass} sm:col-span-3`}>Street address<input className={fieldClass} value={form.line1} onChange={(event) => update('line1', event.target.value)} /></label><label className={labelClass}>City<input className={fieldClass} value={form.city} onChange={(event) => update('city', event.target.value)} /></label><label className={`${labelClass} sm:col-span-2`}>Country<input className={fieldClass} value={form.country} onChange={(event) => update('country', event.target.value)} /></label></div></fieldset>
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">This readiness score is planning guidance based on your answers, not a medical assessment. You can skip height, weight, and address.</div>
            <button type="submit" disabled={pending} className="min-h-12 w-full rounded-xl bg-emerald-900 px-5 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60">{pending ? 'Saving your profile…' : 'Save profile and continue'}</button>
            {session?.user.hasProfile && <button type="button" disabled={pending} onClick={() => void deleteProfile()} className="min-h-10 w-full rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60">Delete fitness profile</button>}
          </form>}
        </section>
        {showContributorRequest && <ContributorRequestPanel />}
      </div>
    </main>
  )
}

function ContributorRequestPanel() {
  const { session } = useAuth()
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!session) return
    try {
      const response = await fetch(`${apiUrl}/contributor-request`, { headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } })
      const result = await response.json() as { requests?: Array<{ status: string }>; error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'Request status could not be loaded.')
      setStatus(result.requests?.[0]?.status ?? null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request status could not be loaded.') }
  }, [session])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])
  async function submit() {
    if (!session) return
    setBusy(true); setError(null)
    try {
      const response = await fetch(`${apiUrl}/contributor-request`, { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ ...(message.trim() ? { message: message.trim() } : {}) }) })
      const result = await response.json() as { status?: string; error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'Your request could not be submitted.')
      setStatus(result.status ?? 'PENDING')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your request could not be submitted.') }
    finally { setBusy(false) }
  }
  const needsPermission = !status || status === 'REJECTED'
  return <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-semibold">Contributor access</h2><p className="mt-2 text-sm leading-6 text-slate-600">Request permission to create and maintain fitness content for the MeFit library.</p>{error && <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>}{status && status !== 'REJECTED' ? <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-900">Request status: {status.toLowerCase()}.</p> : <><label className="mt-4 block text-sm font-medium text-slate-700">Why would you like to contribute? <span className="font-normal text-slate-500">(optional)</span><textarea maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-700" value={message} onChange={(event) => setMessage(event.target.value)} /></label><button type="button" disabled={busy || !needsPermission} onClick={() => void submit()} className="mt-4 min-h-11 rounded-xl bg-emerald-900 px-5 font-semibold text-white disabled:opacity-60">{busy ? 'Submitting…' : status === 'REJECTED' ? 'Request again' : 'Request contributor access'}</button></>}</section>
}
