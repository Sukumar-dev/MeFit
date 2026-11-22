import { Link } from 'react-router-dom'
import { Check, Flame, Footprints, Play } from 'lucide-react'
import { Badge, Card, EmptyState, ProgressRing } from '../components/FitnessDesign'

export function FitnessOverview({ name, now, week, today, workouts, streak }: {
  name: string
  now: Date
  week: { key: string; label: string; date: number }[]
  today: string
  workouts: { workout_date: string; title: string; completed: boolean; exercise_name?: string | null; target_reps?: number | null; target_minutes?: number | null }[]
  streak: number
}) {
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const complete = workouts.filter((workout) => workout.completed).length
  const todayWorkout = workouts.find((workout) => workout.workout_date === today && !workout.completed)
  const finishedToday = workouts.some((workout) => workout.workout_date === today && workout.completed)
  return <>
    <header className="flex flex-wrap items-end justify-between gap-4 py-2">
      <div><p className="mf-muted text-sm font-semibold">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-5xl">{greeting}, {name.trim().split(/\s+/)[0] || 'there'}</h1></div>
      <Badge warm><Flame aria-hidden size={16} /> Streak: {streak} {streak === 1 ? 'day' : 'days'}</Badge>
    </header>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      {todayWorkout ? <section className="mf-dark-surface relative isolate min-h-64 overflow-hidden rounded-[20px] p-6 sm:p-8">
        <img src="/images/editorial/gym.webp" alt="Training in a gym" width={1200} height={800} loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-950/50" />
        <div className="grid min-h-48 content-center justify-items-start gap-3"><p className="font-semibold text-emerald-100">Today’s workout</p><h2 className="max-w-xs text-3xl font-bold">{todayWorkout.title}</h2>{todayWorkout.target_minutes && <p className="text-emerald-100">{todayWorkout.target_minutes} minutes</p>}<Link to="/log" state={{ exercise: todayWorkout.exercise_name, reps: todayWorkout.target_reps }} className="mf-button bg-white text-[#075343]"><Play aria-hidden size={18} /> Start workout</Link></div>
      </section> : <Card className="grid min-h-64 content-center">
        <EmptyState title={finishedToday ? 'Today’s workout is complete' : workouts.length ? 'Take a rest day' : 'Plan your first week'}>
          <p className="mf-muted max-w-sm">{finishedToday ? 'Take a moment to recover and log how your session went.' : workouts.length ? 'Try a relaxed walk or a few minutes of gentle mobility.' : 'Start with a plan that fits the days you have available.'}</p>
          <Link to={workouts.length ? '/log' : '/plan'} className="mf-button mf-button-primary"><Footprints aria-hidden size={18} />{workouts.length ? 'Do a quick workout' : 'Create my weekly plan'}</Link>
        </EmptyState>
      </Card>}
      <Card className="grid content-center justify-items-center gap-3"><h2 className="font-semibold">Weekly progress</h2><ProgressRing complete={complete} total={workouts.length} />
        <ul className="grid w-full grid-cols-7 gap-1 text-center">{week.map((day) => {
          const done = workouts.some((item) => item.workout_date === day.key && item.completed)
          return <li key={day.key} aria-current={today === day.key ? 'date' : undefined} className={`grid min-w-0 justify-items-center gap-1 rounded-lg py-2 text-xs ${today === day.key ? 'bg-[var(--mf-mint)] font-bold' : ''}`}><span>{day.label}</span>{done ? <Check size={14} aria-label="Completed" /> : <span>{day.date}</span>}</li>
        })}</ul>
      </Card>
    </div>
  </>
}
