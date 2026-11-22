import { Link, useParams } from 'react-router-dom'

const movements = {
  squat: ['Squat', 'bodyweight-squat'],
  bridge: ['Glute bridge', 'glute-bridge'],
  lunge: ['Reverse lunge', 'step-back-lunge'],
  press: ['Wall push-up', 'wall-push-up'],
  plank: ['Dead bug', 'dead-bug'],
  balance: ['Bird dog', 'bird-dog'],
  march: ['March in place', 'march-in-place'],
} as const

const workouts = [
  { id: 'lower-body', name: 'Lower-body foundations', type: 'Strength', exercises: ['squat', 'bridge', 'lunge'], sets: 3, reps: 8 },
  { id: 'upper-body', name: 'Upper body and core', type: 'Strength', exercises: ['press', 'plank', 'balance'], sets: 3, reps: 8 },
  { id: 'easy-movement', name: 'Easy movement circuit', type: 'Low impact', exercises: ['march', 'balance', 'bridge'], sets: 2, reps: 6 },
] as const

const programs = [
  { id: 'getting-started', name: 'Getting started', type: 'Beginner', sessions: [workouts[2], workouts[0]] },
  { id: 'strength-foundations', name: 'Strength foundations', type: 'Strength', sessions: [workouts[0], workouts[1]] },
] as const

function Photo({ movement }: { movement: keyof typeof movements }) {
  const [name, image] = movements[movement]
  return <img src={`/images/exercises/${image}.webp`} alt={name} width={320} height={240} loading="lazy" className="aspect-[4/3] w-full rounded-xl bg-slate-100 object-contain" />
}

export function TrainingCatalogPage({ mode }: { mode: 'programs' | 'workouts' }) {
  const { id } = useParams()
  const isProgram = mode === 'programs'
  const items = isProgram ? programs : workouts
  const selected = items.find((item) => item.id === id)
  return <main className="mf-page min-h-screen">
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      <nav aria-label="Training library" className="flex flex-wrap gap-4">
        <Link className="mf-button mf-button-ghost" to="/">Dashboard</Link>
        <Link className="mf-button mf-button-ghost" to="/programs">Programs</Link>
        <Link className="mf-button mf-button-ghost" to="/workouts">Workouts</Link>
        <Link className="mf-button mf-button-ghost" to="/catalog">Exercises</Link>
      </nav>
      <h1 className="text-3xl font-bold">{selected?.name ?? (id ? 'Training item not found' : isProgram ? 'Programs' : 'Workouts')}</h1>
      {selected ? 'sessions' in selected ? (
        <section className="space-y-3" aria-label="Program workouts">
          <p className="mf-muted">{selected.type} program</p>
          {selected.sessions.map((workout) => <Link key={workout.id} className="mf-card block p-4 font-semibold" to={`/workouts/${workout.id}`}>{workout.name}</Link>)}
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Workout exercises">
          {selected.exercises.map((movement) => <article key={movement} className="mf-card space-y-2 p-4"><Photo movement={movement} /><h2 className="font-bold">{movements[movement][0]}</h2><p className="mf-muted">{selected.sets} sets × {selected.reps} reps</p></article>)}
        </section>
      ) : id ? <Link className="mf-button mf-button-primary" to={`/${mode}`}>Back to {mode}</Link> : (
        [...new Set(items.map((item) => item.type))].map((type) => <section key={type} className="space-y-3">
          <h2 className="text-xl font-semibold">{type}</h2>
          <div className="grid gap-4 sm:grid-cols-2">{items.filter((item) => item.type === type).map((item) => <Link key={item.id} className="mf-card block space-y-3 p-4" to={`/${mode}/${item.id}`}><Photo movement={'sessions' in item ? item.sessions[0].exercises[0] : item.exercises[0]} /><h3 className="font-bold">{item.name}</h3></Link>)}</div>
        </section>)
      )}
    </div>
  </main>
}
