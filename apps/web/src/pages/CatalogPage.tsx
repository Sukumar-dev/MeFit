import { useEffect, useState } from 'react'
import { ArrowLeft, Dumbbell, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../auth/api'
import { ExerciseImage } from '../components/ExerciseImage'

type ExerciseItem = { id: string; name: string; description?: string; image_url?: string | null; target_muscle_group?: string; position?: number; sets?: Array<{ repetitions: number | null; duration_seconds?: number | null; rest_seconds?: number | null }> }
type WorkoutItem = { id: string; name: string; type?: string; description: string; exercise_count?: number; exercises?: ExerciseItem[] }
type CatalogGroup = { category?: string; type?: string; target_muscle_group?: string; programs?: Item[]; workouts?: Item[]; exercises?: Item[] }
type Item = { id: string; name: string; description: string; category?: string; type?: string; targetMuscleGroup?: string; target_muscle_group?: string; imageUrl?: string | null; image_url?: string | null; _count?: { exercises?: number; workouts?: number }; workouts?: WorkoutItem[]; exercises?: ExerciseItem[] }

const tabs = [
  { key: 'programs', label: 'Programs', path: '/programs', property: 'programs' as const },
  { key: 'workouts', label: 'Workouts', path: '/workouts', property: 'workouts' as const },
  { key: 'exercises', label: 'Exercises', path: '/exercises', property: 'exercises' as const },
]

export function CatalogPage() {
  const { session } = useAuth()
  const [selected, setSelected] = useState(tabs[0]!)
  const [groups, setGroups] = useState<CatalogGroup[]>([])
  const [search, setSearch] = useState('')
  const [active, setActive] = useState<Item | null>(null)
  const [detail, setDetail] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)
      fetch(`${apiUrl.replace(/\/$/, '')}${selected.path}${search ? `?search=${encodeURIComponent(search)}` : ''}`, { headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' }, signal: controller.signal })
        .then(async (response) => { const result = await response.json() as { groups?: CatalogGroup[]; error?: { message?: string } }; if (!response.ok) throw new Error(result.error?.message ?? 'The catalog could not be loaded.'); return result })
        .then((result) => setGroups(result.groups ?? []))
        .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The catalog could not be loaded.') })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [search, selected, session])

  async function openItem(item: Item) {
    if (!session) return
    setActive(item)
    setDetail(null)
    const path = selected.key === 'programs' ? `/program/${item.id}` : selected.key === 'workouts' ? `/workout/${item.id}` : `/exercises/${item.id}`
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}${path}`, { headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } })
      const result = await response.json() as Item & { error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'This item could not be loaded.')
      setDetail(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This item could not be loaded.') }
  }

  const fieldClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10'
  return <main className="min-h-screen bg-[#f3f7f5] px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 hover:underline"><ArrowLeft size={16} />Dashboard</Link><header className="mt-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Movement library</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Find your next session</h1><p className="mt-2 text-slate-600">Browse programs, workouts, and individual movements.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input aria-label="Search catalog" className={fieldClass} placeholder={`Search ${selected.label.toLowerCase()}`} value={search} onChange={(event) => setSearch(event.target.value)} /></div></header>
    <div className="mt-7 flex w-full flex-wrap rounded-xl border border-slate-200 bg-white p-1 sm:w-fit">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => { setSelected(tab); setActive(null); setSearch('') }} className={`min-h-10 flex-1 rounded-lg px-4 text-sm font-semibold sm:flex-none ${selected.key === tab.key ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{tab.label}</button>)}</div>
    {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}
    {loading ? <div className="mt-8 rounded-2xl bg-white p-8 text-sm text-slate-500" role="status">Loading the library…</div> : <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"> <div className="space-y-7">{groups.map((group) => { const label = group.category ?? group.type ?? group.target_muscle_group ?? 'Other'; const items = group[selected.property] ?? []; return <section key={label}><h2 className="mb-3 text-lg font-semibold">{label}</h2><div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <button type="button" key={item.id} onClick={() => void openItem(item)} className={`rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm sm:p-5 ${active?.id === item.id ? 'border-emerald-700 ring-2 ring-emerald-700/10' : 'border-slate-200'}`}>{selected.key === 'exercises' && <ExerciseImage id={item.id} imageUrl={item.imageUrl} name={item.name} className="mb-4" />}{selected.key === 'workouts' && item.exercises?.[0] && <ExerciseImage id={item.exercises[0].id} imageUrl={item.exercises[0].image_url} name={item.exercises[0].name} className="mb-4" />}{selected.key === 'programs' && <div className="mb-4 grid grid-cols-3 gap-2">{(item.workouts ?? []).slice(0, 3).map((workout) => { const exercise = workout.exercises?.[0]; return exercise ? <ExerciseImage key={workout.id} id={exercise.id} imageUrl={exercise.image_url} name={exercise.name} className="rounded-lg" /> : <span key={workout.id} className="aspect-[3/2] rounded-lg bg-emerald-50" /> })}<span className="sr-only">Program movement previews</span></div>}<span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-900"><Dumbbell size={18} /></span><span className="mt-4 block font-semibold">{item.name}</span><span className="mt-2 block text-sm leading-6 text-slate-600">{item.description}</span><span className="mt-4 block text-xs font-medium text-slate-500">{selected.key === 'programs' ? `${item._count?.workouts ?? 0} workouts` : selected.key === 'workouts' ? `${item._count?.exercises ?? 0} movements` : group.target_muscle_group}</span></button>)}</div></section> })}{groups.length === 0 && <div className="rounded-2xl bg-white p-8 text-sm text-slate-600">No matching items found.</div>}</div>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-700">Details</p>{!active ? <p className="mt-4 text-sm leading-6 text-slate-500">Select an item to see its plan and movement details.</p> : !detail ? <p className="mt-4 text-sm text-slate-500" role="status">Loading details…</p> : <><h2 className="mt-3 text-xl font-semibold">{detail.name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{detail.description}</p>{selected.key === 'exercises' && <ExerciseImage id={detail.id} imageUrl={detail.imageUrl ?? detail.image_url} name={detail.name} className="mt-4" />}{detail.workouts && <ol className="mt-5 space-y-3">{detail.workouts.map((workout) => <li key={workout.id} className="rounded-xl bg-slate-50 p-3"><span className="font-medium">{workout.name}</span><span className="mt-1 block text-xs text-slate-500">{workout.type} · {workout.description}</span>{workout.exercises?.length ? <div className="mt-3 grid grid-cols-2 gap-2">{workout.exercises.map((exercise) => <div key={exercise.id} className="min-w-0"><ExerciseImage id={exercise.id} imageUrl={exercise.image_url} name={exercise.name} className="rounded-lg" /><span className="mt-1 block text-xs font-medium">{exercise.name}</span></div>)}</div> : null}</li>)}</ol>}{detail.exercises && <ol className="mt-5 space-y-3">{detail.exercises.map((exercise) => <li key={`${exercise.position}-${exercise.name}`} className="rounded-xl bg-slate-50 p-3"><ExerciseImage id={exercise.id} imageUrl={exercise.image_url} name={exercise.name} className="mb-3 rounded-lg" /><span className="font-medium">{exercise.name}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{exercise.description}</span>{exercise.sets?.map((set, index) => <span key={index} className="mt-2 block text-xs text-slate-500">Set {index + 1}: {set.repetitions ?? 'Timed'} reps</span>)}</li>)}</ol>}</>}</aside></div>}
  </div></main>
}
