import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Footprints, GripVertical, Minus, Plus } from 'lucide-react'
import { Button, Card, Drawer, EmptyState, Skeleton, Toast, WorkspaceNav } from '../components/FitnessDesign'
import { setTheme, useTheme, type Theme } from '../components/themePreferenceState'
import { TrainingProgress } from './TrainingProgress'
import { FitnessOverview } from './FitnessOverview'
import { useAuth } from '../auth/AuthContext'
import { getSupabaseClient } from '../auth/supabase'

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function weekDates(offset: number, date = new Date()) {
  const monday = new Date(date)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 + offset * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return day
  })
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mf-card space-y-4 p-5 sm:p-6"><h2 className="text-xl font-semibold">{title}</h2>{children}</section>
}

const field = 'mf-field'
const button = 'mf-button mf-button-primary'

export function FitnessWorkspace() {
  const { session, logout } = useAuth()
  const theme = useTheme()
  const [draftTheme, setDraftTheme] = useState<Theme>(theme)
  const [draftUnit, setDraftUnit] = useState<'kg' | 'lb' | null>(null)
  const [toast, setToast] = useState('')
  const [templatePreview, setTemplatePreview] = useState('')
  const [draft, setDraft] = useState<{ day: string; id?: string; title?: string; completed?: boolean; exercise?: string | null; sets?: number | null; reps?: number | null; minutes?: number | null } | null>(null)
  const [activeExercise, setActiveExercise] = useState('')
  const [reps, setReps] = useState(8)
  const [weight, setWeight] = useState(0)
  const [sessionSets, setSessionSets] = useState(0)
  const [summary, setSummary] = useState<number | null>(null)
  const { hash } = useLocation()
  const [params, setParams] = useSearchParams()
  const requestedWeek = Number(params.get('week') ?? 0)
  const week = Number.isInteger(requestedWeek) && Math.abs(requestedWeek) <= 520 ? requestedWeek : 0
  function setWeek(offset: number) {
    if (Math.abs(offset) > 520) return
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (offset) next.set('week', String(offset))
      else next.delete('week')
      return next
    })
  }
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState(false)
  const saveInFlight = useRef(false)
  const [restUntil, setRestUntil] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const pounds = data?.settings?.weight_unit === 'lb'
  const weightFactor = pounds ? 2.2046226218 : 1
  const [now] = useState(() => new Date())
  const days = weekDates(week, now)
  const first = dateKey(days[0])
  const last = dateKey(days[6])
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    void load(first, last, controller.signal).then((result) => {
      if (!controller.signal.aborted) { setData(result); setLoadError(false) }
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true) })
    return () => controller.abort()
  }, [userId, first, last, revision])

  const hasData = Boolean(data)
  useEffect(() => {
    if (hash && hasData) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash, hasData])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!restUntil) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((restUntil - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(() => { tick(); if (Date.now() >= restUntil) window.clearInterval(timer) }, 250)
    return () => window.clearInterval(timer)
  }, [restUntil])

  if (!session) return <Navigate to="/login" replace />
  if (!session.user.hasProfile) return <Navigate to="/profile/setup" replace />

  async function save(action: () => PromiseLike<{ error: unknown }>, onSaved?: () => void) {
    if (saveInFlight.current) return
    saveInFlight.current = true
    setPending(true)
    setActionError('')
    try {
      const { error } = await action()
      if (error) throw error
      setRevision((value) => value + 1)
      onSaved?.()
    } catch { setActionError('The change could not be saved. Check your connection or sign in again.') }
    finally { saveInFlight.current = false; setPending(false) }
  }

  function form(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    return new FormData(event.currentTarget)
  }

  const workouts = data?.workouts.filter((item) => item.workout_date >= first && item.workout_date <= last) ?? []
  const library = data?.exercises ?? []
  const history = data?.progress ?? []
  const db = getSupabaseClient()
  const today = dateKey(now)
  const currentDays = weekDates(0, now)
  const todayWeekFirst = dateKey(currentDays[0])
  const todayWeekLast = dateKey(currentDays[6])
  const logs = data?.logs ?? []
  const trained = new Set(logs.map((log) => log.performed_on))
  const cursor = new Date(now)
  if (!trained.has(today)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (trained.has(dateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  const overview = (data?.overview ?? []).filter((item) => item.workout_date >= todayWeekFirst && item.workout_date <= todayWeekLast)
  const minutes = Math.round(logs.filter((log) => log.performed_on >= todayWeekFirst && log.performed_on <= todayWeekLast).reduce((total, log) => total + log.duration_seconds, 0) / 60)

  return <main className="mf-page min-h-screen">
    <WorkspaceNav name={session.user.displayName} roles={session.user.roles} signOut={() => void logout().catch(() => setActionError('Could not sign out. Please try again.'))} />
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-4 pt-6 pb-28 sm:px-8 lg:pb-12">
      {actionError && <p role="alert" className="text-[var(--mf-error)]">{actionError}</p>}
      {toast && <Toast>{toast}</Toast>}
      {loadError ? <Card><p role="alert">Your fitness data could not be loaded.</p><Button onClick={() => setRevision((value) => value + 1)}>Try again</Button></Card> :
        !data ? <Skeleton /> : <>
        <FitnessOverview name={session.user.displayName} now={now} onStart={(exercise, targetReps) => {
          if (exercise) setActiveExercise(exercise)
          if (targetReps != null) setReps(targetReps)
        }} week={currentDays.map((day) => ({ key: dateKey(day), label: day.toLocaleDateString(undefined, { weekday: 'short' }), date: day.getDate() }))} today={today} workouts={overview} minutes={minutes} streak={streak} measurements={history} recent={logs} />
        <div id="planner"><Panel title="Weekly planner">
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" aria-label="Previous week" onClick={() => setWeek(week - 1)}><ChevronLeft aria-hidden size={18} /></Button>
          <span className="font-semibold">{days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          <Button variant="ghost" aria-label="Next week" onClick={() => setWeek(week + 1)}><ChevronRight aria-hidden size={18} /></Button>
          <Button variant="ghost" onClick={() => setWeek(0)}>Today</Button>
          <Button onClick={() => { setTemplatePreview(''); setDraft({ day: days.some((day) => dateKey(day) === today) ? today : first }) }}><CalendarPlus aria-hidden size={18} /> Add workout</Button>
          <button id="generate-plan" className="mf-button mf-button-secondary" disabled={pending || workouts.length > 0} onClick={() => void save(async () => {
            const { data: profile, error } = await db.from('profiles').select('days_available,experience').eq('id', session.user.id).single()
            if (error) return { error }
            const sessions = ['Full-body strength', 'Low-impact cardio', 'Upper-body strength', 'Lower-body strength', 'Mobility', 'Full-body circuit', 'Active recovery']
            return db.from('weekly_workouts').insert(Array.from({ length: profile.days_available }, (_, index) => ({
              workout_date: dateKey(days[Math.floor(index * 7 / profile.days_available)]),
              title: profile.experience === 'beginner' ? 'Beginner ' + sessions[index].toLowerCase() : sessions[index],
            })))
          })}>Generate a plan for an empty week</button></div>
          <div aria-label="Week days" className="grid auto-cols-[minmax(145px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2 lg:grid-flow-row lg:grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day)
              const items = workouts.filter((item) => item.workout_date === key)
              return <section key={key} aria-current={key === today ? 'date' : undefined} className={`min-w-0 rounded-2xl border border-[var(--mf-border)] p-3 ${key === today ? 'bg-[var(--mf-mint)]' : ''}`}
                onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                  event.preventDefault()
                  const item = workouts.find((workout) => workout.id === event.dataTransfer.getData('text/plain'))
                  if (item && item.workout_date !== key && !pending) void save(() => db.from('weekly_workouts').update({ workout_date: key }).eq('id', item.id))
                }}>
                <h3 className="mb-3 text-sm font-bold">{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</h3>
                {items.length ? <ul className="space-y-2">{items.map((item) => <li key={item.id}>
                  <button className="w-full break-words rounded-xl border border-[var(--mf-border)] bg-[var(--mf-card)] p-2 text-left text-sm font-semibold" draggable
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', item.id)}
                    onClick={() => { setTemplatePreview(item.exercise_name ?? ''); setDraft({ day: key, id: item.id, title: item.title, completed: item.completed, exercise: item.exercise_name, sets: item.target_sets, reps: item.target_reps, minutes: item.target_minutes }) }}>
                    {item.completed ? <Check aria-label="Complete" size={14} /> : <GripVertical aria-hidden size={14} />}{item.title}
                    {item.target_minutes && <span className="mf-muted mt-1 block text-xs">{item.target_minutes} min</span>}
                    {item.exercise_name && <span className="mf-muted mt-1 block text-xs">1 exercise</span>}
                  </button>
                </li>)}</ul> : <div className="mf-muted text-xs"><Footprints aria-hidden size={19} /><p className="mt-2 font-semibold">Rest day</p><p>Take an easy walk.</p></div>}
              </section>
            })}
          </div>
          {draft && <Drawer title={draft.id ? 'Edit workout' : 'Add workout'} close={() => setDraft(null)}>
            <form className="grid gap-4" onSubmit={(event) => {
              const input = form(event)
              const exercise = String(input.get('template') ?? '')
              const title = String(input.get('title')).trim() || exercise
              if (!title) { setActionError('Choose an exercise or enter a workout name.'); return }
              const values = {
                title, workout_date: String(input.get('date')), completed: input.has('complete'),
                exercise_name: exercise || null,
                target_sets: input.get('prescribedSets') ? Number(input.get('prescribedSets')) : null,
                target_reps: input.get('prescribedReps') ? Number(input.get('prescribedReps')) : null,
                target_minutes: input.get('prescribedMinutes') ? Number(input.get('prescribedMinutes')) : null,
              }
              const id = draft.id
              void save(() => id ? db.from('weekly_workouts').update(values).eq('id', id) : db.from('weekly_workouts').insert(values), () => { setDraft(null); setToast('Workout saved.') })
            }}>
              <label className="grid gap-1">Day <select className={field} name="date" defaultValue={draft.day}>{days.map((day) => <option key={dateKey(day)} value={dateKey(day)}>{day.toDateString()}</option>)}</select></label>
              <label className="grid gap-1">Workout name <input className={field} name="title" defaultValue={draft.title} maxLength={120} /></label>
              <label className="grid gap-1">Exercise template <select className={field} name="template" defaultValue={draft.exercise ?? ''} onChange={(event) => setTemplatePreview(event.target.value)}><option value="">Choose an exercise</option>{library.map(({ name }) => <option key={name}>{name}</option>)}</select></label>
              {data.thumbnails.get(templatePreview) && <img src={data.thumbnails.get(templatePreview)} alt={templatePreview} width={120} height={90} loading="lazy" className="aspect-[4/3] rounded-xl object-cover" />}
              <div className="grid grid-cols-3 gap-2">
                <label className="grid min-w-0 gap-1">Sets<input className={field} name="prescribedSets" type="number" min={1} max={20} defaultValue={draft.sets ?? ''} /></label>
                <label className="grid min-w-0 gap-1">Reps<input className={field} name="prescribedReps" type="number" min={0} max={200} defaultValue={draft.reps ?? ''} /></label>
                <label className="grid min-w-0 gap-1">Minutes<input className={field} name="prescribedMinutes" type="number" min={1} max={180} defaultValue={draft.minutes ?? ''} /></label>
              </div>
              {draft.id && <label><input type="checkbox" name="complete" defaultChecked={draft.completed} /> Mark complete</label>}
              {actionError && <p role="alert" className="text-[var(--mf-error)]">{actionError}</p>}
              <div className="flex flex-wrap gap-2"><Button disabled={pending}>Save workout</Button>
              {draft.id && <Button type="button" variant="ghost" disabled={pending} onClick={() => {
                const id = draft.id!
                void save(() => db.from('weekly_workouts').delete().eq('id', id), () => { setDraft(null); setToast('Workout removed.') })
              }}>Remove workout</Button>}</div>
            </form>
          </Drawer>}
        </Panel></div>
        <div id="logging"><Panel title="Workout log">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
            const input = form(event)
            void save(() => db.from('workout_logs').insert({ exercise: String(input.get('exercise')), performed_on: dateKey(new Date()), sets: 1, reps, weight_kg: weight / (pounds ? 2.2046226218 : 1), duration_seconds: Number(input.get('duration')) }), () => { setRestUntil(Date.now() + 60_000); setSessionSets((count) => count + 1); setSummary(null) })
          }}>
            <label>Exercise <select className={field} name="exercise" value={activeExercise || library[0]?.name || ''} onChange={(event) => setActiveExercise(event.target.value)} required>{library.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <Stepper label="Reps" value={reps} setValue={setReps} step={1} />
            <Stepper label={`Weight (${pounds ? 'lb' : 'kg'})`} value={weight} setValue={setWeight} step={pounds ? 5 : 2.5} />
            <label className="grid gap-1">Seconds <input className={field} name="duration" type="number" min="0" defaultValue="0" /></label>
            <Button disabled={pending || !library.length}>Complete set</Button>
          </form>
          <button className={button} onClick={() => setRestUntil(Date.now() + 60_000)}>Start 60-second rest</button> <span role="timer" aria-label="Rest timer">{seconds}s</span>
          {sessionSets > 0 && <Button variant="secondary" onClick={() => { setSummary(sessionSets); setSessionSets(0); setRestUntil(0); setSeconds(0) }}>Finish workout</Button>}
          {summary !== null && <p role="status" className="rounded-xl bg-[var(--mf-mint)] p-3">Workout finished. {summary} {summary === 1 ? 'set' : 'sets'} saved.</p>}
          {!data.logs.length && <EmptyState title="No workouts logged yet"><p className="mf-muted">Save your first set to start tracking.</p></EmptyState>}
          <ul>{data.logs.slice(0, 30).map((log) => <li key={log.id}>{log.performed_on} · {log.exercise} · {log.sets} × {log.reps} · {(log.weight_kg * (pounds ? 2.2046226218 : 1)).toFixed(1)} {pounds ? 'lb' : 'kg'} · {log.duration_seconds}s</li>)}</ul>
        </Panel></div>
        <div id="progress" className="space-y-4"><Panel title="Progress and measurements">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
            const input = form(event)
            void save(() => db.from('fitness_progress').upsert({ user_id: session.user.id, measured_on: String(input.get('date')), weight_kg: Math.min(350, Math.max(25, Number(input.get('weight')) / weightFactor)), waist_cm: input.get('waist') ? Number(input.get('waist')) : null }, { onConflict: 'user_id,measured_on' }))
          }}><label>Date <input className={field} name="date" type="date" defaultValue={today} required /></label><label>Body weight ({pounds ? 'lb' : 'kg'}) <input className={field} name="weight" type="number" inputMode="decimal" min={25 * weightFactor} max={350 * weightFactor} step="any" required /></label><label>Waist (cm) <input className={field} name="waist" type="number" min="30" max="300" step="any" /></label><button className={button} disabled={pending}>Save measurement</button></form>
          {!history.length && <p>No measurements saved yet.</p>}
          <ul className="space-y-2">{history.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-3"><span>{entry.measured_on}</span><meter aria-label={`Weight on ${entry.measured_on}`} min={0} max={Math.max(...history.map((value) => value.weight_kg))} value={entry.weight_kg} /><span>{(entry.weight_kg * (pounds ? 2.2046226218 : 1)).toFixed(1)} {pounds ? 'lb' : 'kg'}{entry.waist_cm ? ` · ${entry.waist_cm} cm waist` : ''}</span></li>)}</ul>
        </Panel><TrainingProgress logs={logs} pounds={pounds} today={now} /></div>
        </>}
      <div id="settings"><Panel title="Settings">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
          event.preventDefault()
          const weight_unit = draftUnit ?? data?.settings?.weight_unit ?? 'kg'
          void save(() => db.from('fitness_settings').upsert({ user_id: session.user.id, weight_unit }), () => { setTheme(draftTheme); setToast('Settings saved.') })
        }}>
          <Card><h3 className="font-bold">Profile</h3><Link className="mf-button mf-button-ghost" to="/profile/setup">Edit fitness profile</Link></Card>
          <Card><h3 className="font-bold">Units</h3><label className="mt-2 grid gap-1">Weight units <select aria-label="Weight units" className={field} value={draftUnit ?? (pounds ? 'lb' : 'kg')} onChange={(event) => setDraftUnit(event.target.value === 'lb' ? 'lb' : 'kg')}><option value="kg">Kilograms</option><option value="lb">Pounds</option></select></label></Card>
          <Card><h3 className="font-bold">Appearance</h3><label className="mt-2 grid gap-1">Theme <select aria-label="Theme" className={field} value={draftTheme} onChange={(event) => setDraftTheme(event.target.value as Theme)}><option value="system">Follow device</option><option value="light">Light</option><option value="dark">Dark</option></select></label></Card>
          <Card><h3 className="font-bold">Account</h3><p className="mf-muted mt-2 break-all text-sm">{session.user.email}</p></Card>
          <Button className="justify-self-start" disabled={pending || !data}>Save settings</Button>
        </form>
      </Panel></div>
    </div>
  </main>
}

function Stepper({ label, value, setValue, step }: { label: string; value: number; setValue: (value: number) => void; step: number }) {
  return <div className="grid gap-1"><span className="font-medium">{label}</span><div className="flex items-center gap-1">
    <Button type="button" variant="secondary" aria-label={`Decrease ${label}`} disabled={value <= 0} onClick={() => setValue(Math.max(0, value - step))}><Minus aria-hidden size={16} /></Button>
    <output className="min-w-10 text-center font-semibold" aria-label={label}>{value}</output>
    <Button type="button" variant="secondary" aria-label={`Increase ${label}`} onClick={() => setValue(value + step)}><Plus aria-hidden size={16} /></Button>
  </div></div>
}

async function load(first: string, last: string, signal: AbortSignal) {
  const db = getSupabaseClient()
  const [workouts, exercises, logs, settings, progress, enriched, overview] = await Promise.all([
    db.from('weekly_workouts').select('*').gte('workout_date', first).lte('workout_date', last).order('workout_date').abortSignal(signal),
    db.from('fitness_exercises').select('*').order('name').abortSignal(signal),
    db.from('workout_logs').select('*').order('performed_on', { ascending: false }).order('id').limit(250).abortSignal(signal),
    db.from('fitness_settings').select('weight_unit').abortSignal(signal).maybeSingle(),
    db.from('fitness_progress').select('*').order('measured_on', { ascending: false }).limit(30).abortSignal(signal),
    db.from('exercise_library').select('name,legacy_names,image_paths').order('name').abortSignal(signal),
    db.from('weekly_workouts').select('*').gte('workout_date', dateKey(weekDates(0)[0])).lte('workout_date', dateKey(weekDates(0)[6])).abortSignal(signal),
  ])
  if (workouts.error || exercises.error || logs.error || progress.error || settings.error || overview.error) throw new Error('Could not load fitness data')
  const names = new Set(exercises.data.map((item) => item.name))
  for (const entry of enriched.data ?? []) names.add(entry.legacy_names[0] || entry.name)
  const thumbnails = new Map((enriched.data ?? []).flatMap((entry) => entry.image_paths[0] ? [[entry.legacy_names[0] || entry.name, entry.image_paths[0]] as const] : []))
  const exerciseOptions = [...names].sort((left, right) => left.localeCompare(right)).map((name) => ({ name }))
  return { workouts: workouts.data, exercises: exerciseOptions, logs: logs.data, progress: progress.data, settings: settings.data, overview: overview.data, thumbnails }
}
