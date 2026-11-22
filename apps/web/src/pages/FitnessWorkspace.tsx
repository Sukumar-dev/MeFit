import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getSupabaseClient } from '../auth/supabase'

function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function weekDates(offset: number) {
  const monday = new Date()
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 + offset * 7)
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return day
  })
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-semibold">{title}</h2>{children}</section>
}

const field = 'min-h-10 rounded-lg border border-slate-300 px-3 py-2'
const button = 'min-h-10 rounded-lg bg-emerald-900 px-3 py-2 font-semibold text-white disabled:opacity-50'

export function FitnessWorkspace() {
  const { session, logout } = useAuth()
  const [week, setWeek] = useState(0)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<Awaited<ReturnType<typeof load>> | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState(false)
  const [search, setSearch] = useState('')
  const [equipment, setEquipment] = useState('')
  const [muscle, setMuscle] = useState('')
  const [restUntil, setRestUntil] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const pounds = data?.settings?.weight_unit === 'lb'
  const days = weekDates(week)
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

  useEffect(() => {
    if (!restUntil) return
    const tick = () => setSeconds(Math.max(0, Math.ceil((restUntil - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [restUntil])

  if (!session) return <Navigate to="/login" replace />
  if (!session.user.hasProfile) return <Navigate to="/profile/setup" replace />

  async function save(action: () => PromiseLike<{ error: unknown }>) {
    setPending(true)
    setActionError('')
    try {
      const { error } = await action()
      if (error) throw error
      setRevision((value) => value + 1)
    } catch { setActionError('The change could not be saved. Check your connection or sign in again.') }
    finally { setPending(false) }
  }

  function form(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    return new FormData(event.currentTarget)
  }

  const workouts = data?.workouts.filter((item) => item.workout_date >= first && item.workout_date <= last) ?? []
  const completed = workouts.filter((item) => item.completed).length
  const completion = workouts.length ? Math.round(100 * completed / workouts.length) : 0
  const library = data?.exercises ?? []
  const history = data?.progress ?? []
  const db = getSupabaseClient()

  return <main className="min-h-screen bg-emerald-50/40 text-slate-900">
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <Link to="/" className="text-xl font-bold">MeFit</Link>
      <nav aria-label="Fitness workspace" className="flex flex-wrap gap-4">
        <a href="#planner">Planner</a><a href="#library">Library</a><a href="#logging">Logging</a><a href="#progress">Progress</a><a href="#settings">Settings</a>
      </nav>
      <button className={button} onClick={() => void logout().catch(() => setActionError('Could not sign out. Please try again.'))}>Sign out</button>
    </header>
    <div className="mx-auto grid max-w-6xl gap-5 px-5 pb-12">
      <h1 className="text-4xl font-semibold">Your fitness dashboard</h1>
      {actionError && <p role="alert" className="text-rose-800">{actionError}</p>}
      {loadError ? <div role="alert"><p>Your fitness data could not be loaded.</p><button className={button} onClick={() => setRevision((value) => value + 1)}>Try again</button></div> :
        !data ? <p role="status">Loading your fitness data…</p> : <>
        <Panel title="This week">
          <p>{completed} of {workouts.length} workouts complete · {completion}%</p>
          <progress aria-label="Weekly completion" value={completion} max={100} />
          <p>Today: {workouts.filter((item) => item.workout_date === dateKey(new Date())).map((item) => item.title).join(', ') || 'Rest day'}</p>
        </Panel>
        <div id="planner"><Panel title="Weekly planner">
          <div className="flex flex-wrap gap-2"><button className={button} onClick={() => setWeek(week - 1)}>Previous week</button><button className={button} onClick={() => setWeek(week + 1)}>Next week</button>
          <button className={button} disabled={pending || workouts.length > 0} onClick={() => void save(async () => {
            const { data: profile, error } = await db.from('profiles').select('days_available,experience').eq('id', session.user.id).single()
            if (error) return { error }
            const sessions = ['Full-body strength', 'Low-impact cardio', 'Upper-body strength', 'Lower-body strength', 'Mobility', 'Full-body circuit', 'Active recovery']
            return db.from('weekly_workouts').insert(Array.from({ length: profile.days_available }, (_, index) => ({
              workout_date: dateKey(days[Math.floor(index * 7 / profile.days_available)]),
              title: profile.experience === 'beginner' ? 'Beginner ' + sessions[index].toLowerCase() : sessions[index],
            })))
          })}>Generate a plan for an empty week</button></div>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
            const input = form(event)
            void save(() => db.from('weekly_workouts').insert({ title: String(input.get('title')).trim(), workout_date: String(input.get('date')) }))
          }}><label>Workout name <input className={field} name="title" required maxLength={120} /></label><label>Day <select className={field} name="date">{days.map((day) => <option key={dateKey(day)} value={dateKey(day)}>{day.toDateString()}</option>)}</select></label><button className={button} disabled={pending}>Add workout</button></form>
          {days.map((day) => <div key={dateKey(day)} className="border-t border-slate-200 pt-3"><h3 className="font-semibold">{day.toDateString()}</h3>
            {workouts.filter((item) => item.workout_date === dateKey(day)).map((item) => <form key={item.id} className="my-2 flex flex-wrap items-end gap-2" onSubmit={(event) => {
              const input = form(event)
              void save(() => db.from('weekly_workouts').update({ title: String(input.get('title')).trim(), workout_date: String(input.get('date')), completed: input.has('complete') }).eq('id', item.id))
            }}><label>Name <input className={field} name="title" defaultValue={item.title} required maxLength={120} /></label><label>Day <select className={field} name="date" defaultValue={item.workout_date}>{days.map((option) => <option key={dateKey(option)} value={dateKey(option)}>{option.toDateString()}</option>)}</select></label><label><input type="checkbox" name="complete" defaultChecked={item.completed} /> Complete</label><button className={button} disabled={pending}>Save workout</button><button type="button" className={field} disabled={pending} onClick={() => void save(() => db.from('weekly_workouts').delete().eq('id', item.id))}>Remove</button></form>)}
            {!workouts.some((item) => item.workout_date === dateKey(day)) && <p>Rest day</p>}
          </div>)}
        </Panel></div>
        <div id="library"><Panel title="Exercise library">
          <div className="flex flex-wrap gap-3"><label>Search <input className={field} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>Equipment <select className={field} value={equipment} onChange={(event) => setEquipment(event.target.value)}><option value="">All</option>{[...new Set(library.map((item) => item.equipment))].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Muscle group <select className={field} value={muscle} onChange={(event) => setMuscle(event.target.value)}><option value="">All</option>{[...new Set(library.map((item) => item.muscle_group))].map((value) => <option key={value}>{value}</option>)}</select></label></div>
          {library.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()) && (!equipment || item.equipment === equipment) && (!muscle || item.muscle_group === muscle)).map((item) => <div key={item.name}>{item.name} · {item.muscle_group} · {item.equipment}</div>)}
        </Panel></div>
        <div id="logging"><Panel title="Workout log">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
            const input = form(event)
            void save(() => db.from('workout_logs').insert({ exercise: String(input.get('exercise')), performed_on: dateKey(new Date()), sets: Number(input.get('sets')), reps: Number(input.get('reps')), weight_kg: Number(input.get('weight')) / (pounds ? 2.2046226218 : 1), duration_seconds: Number(input.get('duration')) }))
          }}>
            <label>Exercise <select className={field} name="exercise" required>{library.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <label>Sets <input className={field} name="sets" type="number" min="1" defaultValue="3" required /></label><label>Reps <input className={field} name="reps" type="number" min="0" defaultValue="8" required /></label><label>Weight ({pounds ? 'lb' : 'kg'}) <input className={field} name="weight" type="number" min="0" step="any" defaultValue="0" /></label><label>Seconds <input className={field} name="duration" type="number" min="0" defaultValue="0" /></label><button className={button} disabled={pending || !library.length}>Log exercise</button>
          </form>
          <button className={button} onClick={() => setRestUntil(Date.now() + 60_000)}>Start 60-second rest</button> <span role="timer" aria-label="Rest timer">{seconds}s</span>
          {!data.logs.length && <p>No workouts logged yet.</p>}
          <ul>{data.logs.map((log) => <li key={log.id}>{log.performed_on} · {log.exercise} · {log.sets} × {log.reps} · {(log.weight_kg * (pounds ? 2.2046226218 : 1)).toFixed(1)} {pounds ? 'lb' : 'kg'} · {log.duration_seconds}s</li>)}</ul>
        </Panel></div>
        <div id="progress"><Panel title="Body measurements">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => {
            const input = form(event)
            void save(() => db.from('fitness_progress').upsert({ user_id: session.user.id, measured_on: String(input.get('date')), weight_kg: Number(input.get('weight')) / (pounds ? 2.2046226218 : 1), waist_cm: input.get('waist') ? Number(input.get('waist')) : null }, { onConflict: 'user_id,measured_on' }))
          }}><label>Date <input className={field} name="date" type="date" defaultValue={dateKey(new Date())} required /></label><label>Body weight ({pounds ? 'lb' : 'kg'}) <input className={field} name="weight" type="number" min={pounds ? 55.12 : 25} max={pounds ? 771.61 : 350} step="any" required /></label><label>Waist (cm) <input className={field} name="waist" type="number" min="30" max="300" step="any" /></label><button className={button} disabled={pending}>Save measurement</button></form>
          {!history.length && <p>No measurements saved yet.</p>}
          <ul className="space-y-2">{history.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-3"><span>{entry.measured_on}</span><meter aria-label={`Weight on ${entry.measured_on}`} min={0} max={Math.max(...history.map((value) => value.weight_kg))} value={entry.weight_kg} /><span>{(entry.weight_kg * (pounds ? 2.2046226218 : 1)).toFixed(1)} {pounds ? 'lb' : 'kg'}{entry.waist_cm ? ` · ${entry.waist_cm} cm waist` : ''}</span></li>)}</ul>
        </Panel></div>
        </>}
      <div id="settings"><Panel title="Settings"><Link className="underline" to="/profile/setup">Edit fitness profile</Link><label className="block">Weight units <select className={field} value={pounds ? 'lb' : 'kg'} disabled={pending || !data} onChange={(event) => { const weight_unit = event.target.value === 'lb' ? 'lb' : 'kg'; void save(() => db.from('fitness_settings').upsert({ user_id: session.user.id, weight_unit })) }}><option value="kg">Kilograms</option><option value="lb">Pounds</option></select></label></Panel></div>
    </div>
  </main>
}

async function load(first: string, last: string, signal: AbortSignal) {
  const db = getSupabaseClient()
  const [workouts, exercises, logs, settings, progress] = await Promise.all([
    db.from('weekly_workouts').select('*').gte('workout_date', first).lte('workout_date', last).order('workout_date').abortSignal(signal),
    db.from('fitness_exercises').select('*').order('name').abortSignal(signal),
    db.from('workout_logs').select('*').order('performed_on', { ascending: false }).limit(30).abortSignal(signal),
    db.from('fitness_settings').select('weight_unit').abortSignal(signal).maybeSingle(),
    db.from('fitness_progress').select('*').order('measured_on', { ascending: false }).limit(30).abortSignal(signal),
  ])
  if (workouts.error || exercises.error || logs.error || progress.error || settings.error) throw new Error('Could not load fitness data')
  return { workouts: workouts.data, exercises: exercises.data, logs: logs.data, progress: progress.data, settings: settings.data }
}
