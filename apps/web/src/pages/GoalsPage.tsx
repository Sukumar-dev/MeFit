import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle2, CirclePause, CirclePlay, Pencil, Plus, Save, Target, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../auth/api'

type PlanItem = { id: string; name: string; type?: string; description: string; _count?: { workouts?: number; exercises?: number } }
type WorkoutPlan = { id: string; name: string; type: string; prescription: unknown; completed_at: string | null }
type Goal = {
  id: string; name: string; description: string; objective: string; start_date: string; end_date: string; timezone: string; status: 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  workout_frequency: number; preferred_duration: number; difficulty: string; notes: string; program_id: string | null; program_name: string | null
  workout_ids: string[]; custom_workouts: Array<{ name: string; type: string; description: string }>; total_workouts: number; completed_workouts: number; progress_percent: number; workouts: WorkoutPlan[]
}
type Draft = Omit<Goal, 'id' | 'status' | 'program_name' | 'total_workouts' | 'completed_workouts' | 'progress_percent' | 'workouts'>
type ApiError = { error?: { message?: string } }

function localDate(date: Date) { return new Intl.DateTimeFormat('en-CA').format(date) }
function initialDraft(): Draft {
  const now = new Date()
  const start = localDate(now)
  const end = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6))
  return { name: '', description: '', objective: 'GENERAL_FITNESS', start_date: start, end_date: end, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', workout_frequency: 3, preferred_duration: 30, difficulty: 'BEGINNER', notes: '', program_id: null, workout_ids: [], custom_workouts: [] }
}

export function GoalsPage() {
  const { session } = useAuth()
  const [programs, setPrograms] = useState<PlanItem[]>([])
  const [workouts, setWorkouts] = useState<PlanItem[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' }
      const [programResponse, workoutResponse, goalResponse] = await Promise.all([
        fetch(`${apiUrl}/programs`, { headers }), fetch(`${apiUrl}/workouts`, { headers }), fetch(`${apiUrl}/goal`, { headers }),
      ])
      const [programData, workoutData, goalData] = await Promise.all([
        programResponse.json() as Promise<{ groups?: Array<{ programs: PlanItem[] }> }>,
        workoutResponse.json() as Promise<{ groups?: Array<{ workouts: PlanItem[] }> }>,
        goalResponse.json() as Promise<{ goals?: Goal[] } & ApiError>,
      ])
      if (!programResponse.ok || !workoutResponse.ok || !goalResponse.ok) throw new Error(goalData.error?.message ?? 'Your goals could not be loaded.')
      setPrograms(programData.groups?.flatMap((group) => group.programs) ?? [])
      setWorkouts(workoutData.groups?.flatMap((group) => group.workouts) ?? [])
      setGoals(goalData.goals ?? [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your goals could not be loaded.') }
    finally { setLoading(false) }
  }, [session])

  useEffect(() => { void load() }, [load])

  function startCreate() {
    setDraft(initialDraft()); setEditingId(null); setFormOpen(true); setError(null); setSuccess(null)
  }
  function startEdit(goal: Goal) {
    setDraft({ name: goal.name, description: goal.description, objective: goal.objective, start_date: goal.start_date, end_date: goal.end_date, timezone: goal.timezone, workout_frequency: goal.workout_frequency, preferred_duration: goal.preferred_duration, difficulty: goal.difficulty, notes: goal.notes, program_id: goal.program_id, workout_ids: goal.workout_ids, custom_workouts: goal.custom_workouts.map((item) => ({ ...item })) })
    setEditingId(goal.id); setFormOpen(true); setError(null); setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function cancelEdit() { setFormOpen(false); setEditingId(null); setDraft(initialDraft()); setError(null) }
  function update<K extends keyof Draft>(field: K, value: Draft[K]) { setDraft((current) => ({ ...current, [field]: value })) }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setPending('save'); setError(null); setSuccess(null)
    const method = editingId ? 'PATCH' : 'POST'
    const url = editingId ? `${apiUrl}/goal/${editingId}` : `${apiUrl}/goal`
    try {
      const response = await fetch(url, { method, headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(draft) })
      const result = await response.json() as ApiError
      if (!response.ok) throw new Error(result.error?.message ?? 'Your goal could not be saved.')
      setSuccess(editingId ? 'Your goal has been updated.' : 'Your goal has been created.')
      setFormOpen(false); setEditingId(null)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your goal could not be saved.') }
    finally { setPending(null) }
  }

  async function changeStatus(goal: Goal, status: Goal['status']) {
    if (!session) return
    setPending(goal.id); setError(null); setSuccess(null)
    try {
      const response = await fetch(`${apiUrl}/goal/${goal.id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ status }) })
      const result = await response.json() as ApiError
      if (!response.ok) throw new Error(result.error?.message ?? 'The goal status could not be changed.')
      setSuccess(`Goal marked ${status.toLowerCase()}.`)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The goal status could not be changed.') }
    finally { setPending(null) }
  }

  async function deleteGoal(goal: Goal) {
    if (!session || !window.confirm(`Delete “${goal.name}”? Its workout completion history will also be removed.`)) return
    setPending(goal.id); setError(null); setSuccess(null)
    try {
      const response = await fetch(`${apiUrl}/goal/${goal.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } })
      const result = response.status === 204 ? {} : await response.json() as ApiError
      if (!response.ok) throw new Error(result.error?.message ?? 'The goal could not be deleted.')
      setSuccess('Your goal has been deleted.')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The goal could not be deleted.') }
    finally { setPending(null) }
  }

  async function completeWorkout(goal: Goal, workout: WorkoutPlan) {
    if (!session) return
    const key = `${goal.id}:${workout.id}`
    setPending(key); setError(null); setSuccess(null)
    try {
      const response = await fetch(`${apiUrl}/goal/${goal.id}/workouts/${workout.id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } })
      const result = response.status === 204 ? {} : await response.json() as ApiError
      if (!response.ok) throw new Error(result.error?.message ?? 'The workout could not be marked complete.')
      setSuccess('Workout completion saved.')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The workout could not be marked complete.') }
    finally { setPending(null) }
  }

  const input = 'mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10'
  const label = 'block text-sm font-medium text-slate-700'
  const activeGoals = goals.filter((goal) => goal.status === 'ACTIVE')
  const pausedGoals = goals.filter((goal) => goal.status === 'PAUSED')
  const completedGoals = goals.filter((goal) => goal.status === 'COMPLETED')

  return <main className="min-h-screen bg-[#f3f7f5] px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 hover:underline"><ArrowLeft size={16} />Dashboard</Link>
    <header className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Your personal plan</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Manage goals</h1><p className="mt-2 max-w-2xl text-slate-600">Set your own fitness objective, schedule, and target dates. Your plans and progress are saved to your account.</p></div><button type="button" onClick={startCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><Plus size={17} />New goal</button></header>
    {error && <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div>}{success && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{success}</div>}

    {formOpen && <form onSubmit={(event) => void saveGoal(event)} className="mt-7 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">{editingId ? 'Update your plan' : 'Create a personal goal'}</p><h2 className="mt-1 text-2xl font-semibold">{editingId ? 'Edit goal' : 'New fitness goal'}</h2></div><button type="button" onClick={cancelEdit} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><X size={16} />Cancel</button></div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className={label}>Goal name<input required minLength={2} maxLength={120} className={input} value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Build a consistent routine" /></label>
        <label className={label}>Fitness objective<select className={input} value={draft.objective} onChange={(event) => update('objective', event.target.value)}><option value="WEIGHT_LOSS">Weight Loss</option><option value="MUSCLE_GAIN">Muscle Gain</option><option value="STRENGTH">Strength</option><option value="ENDURANCE">Endurance</option><option value="FLEXIBILITY">Flexibility</option><option value="GENERAL_FITNESS">General Fitness</option></select></label>
        <label className={`${label} md:col-span-2`}>Description<textarea maxLength={1000} className={`${input} min-h-20 py-3`} value={draft.description} onChange={(event) => update('description', event.target.value)} placeholder="What would you like to achieve?" /></label>
        <label className={label}>Start date<input required type="date" className={input} value={draft.start_date} onChange={(event) => update('start_date', event.target.value)} /></label>
        <label className={label}>Target completion date<input required type="date" min={draft.start_date} className={input} value={draft.end_date} onChange={(event) => update('end_date', event.target.value)} /></label>
        <label className={label}>Workout days per week<input required type="number" min={1} max={7} className={input} value={draft.workout_frequency} onChange={(event) => update('workout_frequency', Number(event.target.value))} /></label>
        <label className={label}>Preferred workout duration (minutes)<input required type="number" min={10} max={180} step={5} className={input} value={draft.preferred_duration} onChange={(event) => update('preferred_duration', Number(event.target.value))} /></label>
        <label className={label}>Difficulty level<select className={input} value={draft.difficulty} onChange={(event) => update('difficulty', event.target.value)}><option value="BEGINNER">Beginner</option><option value="INTERMEDIATE">Intermediate</option><option value="ADVANCED">Advanced</option></select></label>
        <label className={label}>Start from a program<select className={input} value={draft.program_id ?? ''} onChange={(event) => update('program_id', event.target.value || null)}><option value="">No program selected</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
        <fieldset className="md:col-span-2"><legend className="text-sm font-semibold">Choose workouts for this goal</legend><p className="mt-1 text-xs text-slate-500">Keep selected sessions when editing to retain their completion progress.</p><div className="mt-3 grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{workouts.map((workout) => <label key={workout.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={draft.workout_ids.includes(workout.id)} onChange={(event) => update('workout_ids', event.target.checked ? [...draft.workout_ids, workout.id] : draft.workout_ids.filter((id) => id !== workout.id))} className="mt-1 accent-emerald-800" /><span><span className="font-medium">{workout.name}</span><span className="mt-0.5 block text-xs text-slate-500">{workout.type}</span></span></label>)}</div></fieldset>
        <fieldset className="md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><legend className="text-sm font-semibold">Custom workouts</legend><button type="button" onClick={() => update('custom_workouts', [...draft.custom_workouts, { name: '', type: 'Strength', description: '' }])} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"><Plus size={14} />Add custom workout</button></div>
          {draft.custom_workouts.map((custom, index) => <div key={index} className="mt-3 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3"><label className={label}>Workout name<input required minLength={2} className={input} value={custom.name} onChange={(event) => update('custom_workouts', draft.custom_workouts.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label className={label}>Workout type<input required minLength={2} className={input} value={custom.type} onChange={(event) => update('custom_workouts', draft.custom_workouts.map((item, i) => i === index ? { ...item, type: event.target.value } : item))} /></label><label className={label}>Session details<input required minLength={3} className={input} value={custom.description} onChange={(event) => update('custom_workouts', draft.custom_workouts.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} /></label><button type="button" onClick={() => update('custom_workouts', draft.custom_workouts.filter((_, i) => i !== index))} className="inline-flex min-h-9 items-center gap-1 justify-self-start text-xs font-semibold text-rose-700 hover:underline"><Trash2 size={14} />Remove custom workout</button></div>)}
        </fieldset>
        <label className={`${label} md:col-span-2`}>Personal notes and requirements<textarea maxLength={3000} className={`${input} min-h-24 py-3`} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Add preferences, limitations, or anything else to keep in mind." /></label>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={cancelEdit} className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={pending === 'save'} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"><Save size={16} />{pending === 'save' ? 'Saving…' : editingId ? 'Save changes' : 'Create goal'}</button></div>
    </form>}

    {loading ? <div className="mt-7 rounded-2xl bg-white p-8 text-sm text-slate-500" role="status">Loading your goals…</div> : goals.length === 0 ? <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-900"><Target /></span><h2 className="mt-4 text-xl font-semibold">No goals yet</h2><p className="mt-2 text-sm text-slate-600">Create a goal that fits your routine and preferences.</p><button type="button" onClick={startCreate} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-900 px-4 text-sm font-semibold text-white hover:bg-emerald-800"><Plus size={16} />Create your first goal</button></section> : <div className="mt-7 space-y-8">
      {[["Active goals", activeGoals], ["Paused goals", pausedGoals], ["Completed goals", completedGoals]].filter(([, items]) => (items as Goal[]).length > 0).map(([heading, items]) => <section key={heading as string}><h2 className="mb-3 text-lg font-semibold">{heading as string}<span className="ml-2 text-sm font-normal text-slate-500">({(items as Goal[]).length})</span></h2><div className="grid gap-4 lg:grid-cols-2">{(items as Goal[]).map((goal) => <article key={goal.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700"><Target size={15} />{goal.objective.replaceAll('_', ' ')}</p><h3 className="mt-2 break-words text-xl font-semibold">{goal.name}</h3><p className="mt-1 text-xs font-medium text-slate-500">{goal.status === 'ACTIVE' ? 'Active' : goal.status === 'PAUSED' ? 'Paused' : 'Completed'}</p></div><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-sm font-bold text-emerald-900">{goal.progress_percent}%</div></div>
        {goal.description && <p className="mt-3 text-sm leading-6 text-slate-600">{goal.description}</p>}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${goal.progress_percent}%` }} /></div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{goal.start_date} → {goal.end_date}</span><span>{goal.workout_frequency} days/week · {goal.preferred_duration} min</span><span>{goal.completed_workouts}/{goal.total_workouts} sessions complete</span><span>{goal.difficulty.toLowerCase()} · {goal.workouts.length} sessions</span></div>
        {goal.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{goal.notes}</p>}
        <ul className="mt-4 space-y-2">{goal.workouts.map((workout) => <li key={workout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{workout.name}</span><span className="text-xs text-slate-500">{workout.type}</span></span><div className="flex items-center gap-3"><span className={`shrink-0 text-xs font-semibold ${workout.completed_at ? 'text-emerald-800' : 'text-slate-500'}`}>{workout.completed_at ? 'Complete' : 'Planned'}</span>{(goal.status === 'ACTIVE' || workout.completed_at) && <button type="button" disabled={Boolean(workout.completed_at) || goal.status !== 'ACTIVE' || pending === `${goal.id}:${workout.id}`} onClick={() => void completeWorkout(goal, workout)} className="min-h-8 rounded-lg bg-emerald-900 px-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:bg-emerald-100 disabled:text-emerald-900">{workout.completed_at ? 'Done' : 'Mark done'}</button>}</div></li>)}</ul>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" disabled={pending === goal.id} onClick={() => startEdit(goal)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Pencil size={14} />Edit</button>
          {goal.status === 'ACTIVE' ? <button type="button" disabled={pending === goal.id} onClick={() => void changeStatus(goal, 'PAUSED')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"><CirclePause size={14} />Pause</button> : goal.status === 'PAUSED' ? <button type="button" disabled={pending === goal.id} onClick={() => void changeStatus(goal, 'ACTIVE')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"><CirclePlay size={14} />Resume</button> : <button type="button" disabled={pending === goal.id} onClick={() => void changeStatus(goal, 'ACTIVE')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"><CirclePlay size={14} />Set active</button>}
          {goal.status !== 'COMPLETED' && <button type="button" disabled={pending === goal.id} onClick={() => void changeStatus(goal, 'COMPLETED')} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"><CheckCircle2 size={14} />Complete</button>}
          <button type="button" disabled={pending === goal.id} onClick={() => void deleteGoal(goal)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50"><Trash2 size={14} />Delete</button>
        </div>
      </article>)}</div></section>)}
    </div>}
  </div></main>
}
