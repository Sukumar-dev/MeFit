import { Activity, CalendarCheck, Check, Flame, Footprints, Play, Scale, Timer } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, Card, EmptyState, ProgressRing, StatCard } from '../components/FitnessDesign'

export function FitnessOverview({ name, now, onStart, week, today, workouts, minutes, streak, measurements, recent }: {
  name: string
  now: Date
  onStart: (exercise?: string | null, reps?: number | null) => void
  week: { key: string; label: string; date: number }[]
  today: string
  workouts: { workout_date: string; title: string; completed: boolean; exercise_name?: string | null; target_reps?: number | null; target_minutes?: number | null }[]
  minutes: number
  streak: number
  measurements: { measured_on: string; weight_kg: number }[]
  recent: { id: string; performed_on: string; exercise: string; sets: number }[]
}) {
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const complete = workouts.filter((workout) => workout.completed).length
  const todayWorkout = workouts.find((workout) => workout.workout_date === today && !workout.completed)
  const finishedToday = workouts.some((workout) => workout.workout_date === today && workout.completed)
  const trend = measurements.length > 1 ? measurements[0].weight_kg - measurements[1].weight_kg : null
  const chart = [...measurements].reverse().map((entry) => ({ date: entry.measured_on.slice(5), weight: entry.weight_kg }))
  return <>
    <header className="flex flex-wrap items-end justify-between gap-4 py-2">
      <div><p className="mf-muted text-sm font-semibold">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{greeting}, {name.trim().split(/\s+/)[0] || 'there'}</h1></div>
      <Badge warm><Flame aria-hidden size={16} /> {streak}-day streak</Badge>
    </header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard icon={CalendarCheck} label="Workouts this week" value={String(complete)} detail={`${workouts.length} planned`} />
      <StatCard icon={Timer} label="Minutes trained" value={String(minutes)} detail="Logged this week" />
      <StatCard icon={Flame} label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} detail="Consecutive training days" />
      <StatCard icon={Scale} label="Weight change" value={trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg`} detail={trend === null ? 'Log two measurements' : 'Since last measurement'} />
    </div>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      {todayWorkout ? <section className="mf-dark-surface relative isolate min-h-64 overflow-hidden rounded-[20px] p-6 sm:p-8">
        <img src="/images/editorial/gym.webp" alt="Training in a gym" width={1200} height={800} loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-950/50" />
        <div className="grid min-h-48 content-center justify-items-start gap-3"><p className="font-semibold text-emerald-100">Today’s workout</p><h2 className="max-w-xs text-3xl font-bold">{todayWorkout.title}</h2>{todayWorkout.target_minutes && <p className="text-emerald-100">{todayWorkout.target_minutes} minutes</p>}<a href="#logging" onClick={() => onStart(todayWorkout.exercise_name, todayWorkout.target_reps)} className="mf-button bg-white text-[#075343]"><Play aria-hidden size={18} /> Start workout</a></div>
      </section> : <Card className="grid min-h-64 content-center">
        <EmptyState title={finishedToday ? 'Today’s workout is complete' : workouts.length ? 'Take a rest day' : 'Plan your first week'}>
          <p className="mf-muted max-w-sm">{finishedToday ? 'Take a moment to recover and log how your session went.' : workouts.length ? 'Try a relaxed walk or a few minutes of gentle mobility.' : 'Start with a plan that fits the days you have available.'}</p>
          <a href={workouts.length ? '#progress' : '#generate-plan'} className="mf-button mf-button-primary"><Footprints aria-hidden size={18} />{workouts.length ? 'See progress' : 'Generate my weekly plan'}</a>
        </EmptyState>
      </Card>}
      <Card className="grid content-center justify-items-center gap-3"><h2 className="font-semibold">Weekly progress</h2><ProgressRing complete={complete} total={workouts.length} />
        <ul className="grid w-full grid-cols-7 gap-1 text-center">{week.map((day) => {
          const done = workouts.some((item) => item.workout_date === day.key && item.completed)
          return <li key={day.key} aria-current={today === day.key ? 'date' : undefined} className={`grid min-w-0 justify-items-center gap-1 rounded-lg py-2 text-xs ${today === day.key ? 'bg-[var(--mf-mint)] font-bold' : ''}`}><span>{day.label}</span>{done ? <Check size={14} aria-label="Completed" /> : <span>{day.date}</span>}</li>
        })}</ul>
      </Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="font-semibold">Weight trend</h2>{chart.length < 2 ? <p className="mf-muted mt-3 text-sm">Add two measurements to see your trend.</p> : <div className="mt-4 h-40 min-w-0"><ResponsiveContainer><LineChart data={chart} margin={{ left: -13, right: 10 }} accessibilityLayer><CartesianGrid vertical={false} stroke="var(--mf-border)" /><XAxis dataKey="date" tick={{ fill: 'var(--mf-muted)', fontSize: 11 }} /><YAxis unit=" kg" domain={['auto', 'auto']} tick={{ fill: 'var(--mf-muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--mf-card)', color: 'var(--mf-text)' }} /><Line dataKey="weight" name="Weight (kg)" stroke="var(--mf-green)" strokeWidth={3} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}</Card>
      <Card><h2 className="font-semibold">Recent activity</h2>{recent.length ? <ul className="mt-3 space-y-3">{recent.slice(0, 4).map((entry) => <li key={entry.id} className="flex items-center gap-3"><Activity aria-hidden className="size-4 text-[var(--mf-green)]" /><span className="min-w-0 flex-1 font-medium">{entry.exercise}</span><span className="mf-muted text-xs">{entry.sets} sets · {entry.performed_on}</span></li>)}</ul> : <EmptyState title="No workouts logged yet"><p className="mf-muted text-sm">Completed sets will appear here.</p></EmptyState>}</Card>
    </div>
  </>
}
