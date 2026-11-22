import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, Archive, Pencil, Plus, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../auth/api'

type Exercise = { id: string; name: string; description: string; targetMuscleGroup: string }
type Workout = { id: string; name: string; type: string; description: string }
type OwnItem = { id: string; name: string; category?: string; targetMuscleGroup?: string; type?: string; archivedAt?: string | null }
type Kind = 'exercise' | 'workout' | 'program'

export function ContributorPage() {
  const { session } = useAuth()
  const isAdmin = session?.user.roles.includes('ADMIN') === true
  const [selectedKind, setKind] = useState<Kind>('exercise')
  const kind = selectedKind === 'exercise' && !isAdmin ? 'workout' : selectedKind
  const enabledKinds: Kind[] = isAdmin ? ['exercise', 'workout', 'program'] : ['workout', 'program']
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [group, setGroup] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [exerciseIds, setExerciseIds] = useState<string[]>([])
  const [repetitions, setRepetitions] = useState('8')
  const [setCount, setSetCount] = useState('1')
  const [workoutIds, setWorkoutIds] = useState<string[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [own, setOwn] = useState<Record<Kind, OwnItem[]>>({ exercise: [], workout: [], program: [] })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    try {
      const headers = { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' }
      const [e, w, authored] = await Promise.all([
        fetch(`${apiUrl}/exercises`, { headers }).then(async (r) => { const v = await r.json() as { groups?: Array<{ exercises: Array<{ id: string; name: string; description: string; target_muscle_group: string }> }> }; if (!r.ok) throw new Error('Could not load exercises'); return v }),
        fetch(`${apiUrl}/workouts`, { headers }).then(async (r) => { const v = await r.json() as { groups?: Array<{ workouts: Workout[] }> }; if (!r.ok) throw new Error('Could not load workouts'); return v }),
        fetch(`${apiUrl}/contributor/content`, { headers }).then(async (r) => { const v = await r.json() as { exercises?: OwnItem[]; workouts?: OwnItem[]; programs?: OwnItem[]; error?: { message?: string } }; if (!r.ok) throw new Error(v.error?.message ?? 'Could not load your content'); return v }),
      ])
      setExercises(e.groups?.flatMap((g) => g.exercises.map((item) => ({ id: item.id, name: item.name, description: item.description, targetMuscleGroup: item.target_muscle_group }))) ?? [])
      setWorkouts(w.groups?.flatMap((g) => g.workouts) ?? [])
      setOwn({ exercise: authored.exercises ?? [], workout: authored.workouts ?? [], program: authored.programs ?? [] })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Contributor content could not be loaded.') }
    finally { setLoading(false) }
  }, [session])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  function reset() { setEditingId(null); setName(''); setDescription(''); setGroup(''); setImageUrl(''); setVideoUrl(''); setExerciseIds([]); setWorkoutIds([]); setRepetitions('8'); setSetCount('1') }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setPending(true); setError(null); setNotice(null)
    try {
      let path: string; let payload: unknown
      if (kind === 'exercise') { path = editingId ? `/exercise/${editingId}` : '/exercise'; payload = { name, description, target_muscle_group: group, ...(imageUrl ? { image_url: imageUrl } : {}), ...(videoUrl ? { video_url: videoUrl } : {}) } }
      else if (kind === 'workout') { path = editingId ? `/workout/${editingId}` : '/workout'; payload = { name, type: group, description, exercises: exerciseIds.map((exercise_id, position) => ({ exercise_id, position, sets: Array.from({ length: Number(setCount) }, () => ({ repetitions: Number(repetitions), rest_seconds: 45 })) })) } }
      else { path = editingId ? `/program/${editingId}` : '/program'; payload = { name, category: group, description, workout_ids: workoutIds } }
      const response = await fetch(`${apiUrl}${path}`, { method: editingId ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'Content could not be saved.')
      setNotice(editingId ? 'Your changes have been saved.' : `${kind[0]!.toUpperCase()}${kind.slice(1)} added to the library.`)
      reset(); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Content could not be saved.') }
    finally { setPending(false) }
  }

  async function edit(item: OwnItem) {
    if (!session) return
    setError(null); setNotice(null)
    try {
      const path = kind === 'exercise' ? `/exercises/${item.id}` : kind === 'workout' ? `/workout/${item.id}` : `/program/${item.id}`
      const response = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } })
      const result = await response.json() as { name: string; description: string; target_muscle_group?: string; targetMuscleGroup?: string; imageUrl?: string | null; videoUrl?: string | null; type?: string; category?: string; exercises?: Array<{ id: string; sets?: Array<{ repetitions: number | null }> }>; workouts?: Array<{ id: string }> }
      if (!response.ok) throw new Error('The selected content could not be loaded for editing.')
      setEditingId(item.id); setName(result.name); setDescription(result.description); setGroup(result.target_muscle_group ?? result.targetMuscleGroup ?? result.type ?? result.category ?? '')
      setImageUrl(result.imageUrl ?? ''); setVideoUrl(result.videoUrl ?? '')
      setExerciseIds(result.exercises?.map((exercise) => exercise.id) ?? []); setWorkoutIds(result.workouts?.map((workout) => workout.id) ?? [])
      if (result.exercises?.[0]?.sets?.length) { setSetCount(String(result.exercises[0].sets.length)); setRepetitions(String(result.exercises[0].sets[0]?.repetitions ?? 8)) }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The selected content could not be loaded.') }
  }

  async function archive(item: OwnItem) {
    if (!session || !window.confirm(`Archive “${item.name}”? It will be hidden from the public library.`)) return
    setPending(true); setError(null); setNotice(null)
    try {
      const response = await fetch(`${apiUrl}/${kind}/${item.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' } })
      if (!response.ok) { const result = await response.json() as { error?: { message?: string } }; throw new Error(result.error?.message ?? 'The item could not be archived.') }
      setNotice('Content archived. Existing goals keep their saved plan snapshot.')
      if (editingId === item.id) reset()
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The item could not be archived.') }
    finally { setPending(false) }
  }

  const input = 'mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10'
  const label = 'block text-sm font-medium text-slate-700'
  const currentItems = own[kind]
  return <main className="min-h-screen bg-[#f3f7f5] px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 hover:underline"><ArrowLeft size={16} />Dashboard</Link><header className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Contributor workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Manage fitness content</h1><p className="mt-2 text-slate-600">Create, revise, or archive library items that you authored.</p></header>
    {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}{notice && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</p>}
    <div className="mt-6 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">{enabledKinds.map((item) => <button key={item} type="button" aria-pressed={kind === item} onClick={() => { setKind(item); reset() }} className={`min-h-10 rounded-lg px-4 text-sm font-semibold capitalize ${kind === item ? 'bg-emerald-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{item}s</button>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]"><form onSubmit={(event) => void save(event)} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-semibold">{editingId ? <><Pencil size={18} />Edit {kind}</> : <><Plus size={18} />Add {kind}</>}</h2><label className={label}>Name<input required minLength={2} maxLength={120} className={input} value={name} onChange={(event) => setName(event.target.value)} /></label><label className={label}>{kind === 'exercise' ? 'Target muscle group' : kind === 'workout' ? 'Workout type' : 'Category'}<input required minLength={2} maxLength={80} className={input} value={group} onChange={(event) => setGroup(event.target.value)} placeholder={kind === 'exercise' ? 'e.g. Legs' : kind === 'workout' ? 'e.g. Strength' : 'e.g. Beginner'} /></label><label className={label}>Description<textarea required minLength={5} maxLength={2000} className={`${input} min-h-24 py-3`} value={description} onChange={(event) => setDescription(event.target.value)} /></label>{kind === 'exercise' && <><label className={label}>Image URL (HTTPS)<input type="url" className={input} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label><label className={label}>Video URL (HTTPS)<input type="url" className={input} value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} /></label></>}{kind === 'workout' && <><div className="grid grid-cols-2 gap-3"><label className={label}>Repetitions<input type="number" min="1" max="500" required className={input} value={repetitions} onChange={(event) => setRepetitions(event.target.value)} /></label><label className={label}>Sets per exercise<input type="number" min="1" max="30" required className={input} value={setCount} onChange={(event) => setSetCount(event.target.value)} /></label></div><fieldset><legend className="text-sm font-semibold">Select exercise movements</legend><div className="mt-3 max-h-48 space-y-2 overflow-auto">{exercises.map((exercise) => <label key={exercise.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" className="mt-1 accent-emerald-800" checked={exerciseIds.includes(exercise.id)} onChange={(event) => setExerciseIds((ids) => event.target.checked ? [...ids, exercise.id] : ids.filter((id) => id !== exercise.id))} /><span className="font-medium">{exercise.name}<span className="ml-2 text-xs font-normal text-slate-500">{exercise.targetMuscleGroup}</span><span className="mt-1 block text-xs font-normal text-slate-600">{exercise.description}</span></span></label>)}</div></fieldset></>}{kind === 'program' && <fieldset><legend className="text-sm font-semibold">Select workouts</legend><div className="mt-3 max-h-48 space-y-2 overflow-auto">{workouts.map((workout) => <label key={workout.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" className="accent-emerald-800" checked={workoutIds.includes(workout.id)} onChange={(event) => setWorkoutIds((ids) => event.target.checked ? [...ids, workout.id] : ids.filter((id) => id !== workout.id))} /><span className="font-medium">{workout.name}<span className="ml-2 text-xs font-normal text-slate-500">{workout.type}</span></span></label>)}</div></fieldset>}<div className="flex gap-3"><button type="submit" disabled={pending} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-900 px-4 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"><Save size={16} />{pending ? 'Saving…' : editingId ? 'Save changes' : `Create ${kind}`}</button>{editingId && <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold">Cancel</button>}</div></form>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">Your {kind}s</h2>{loading ? <p className="mt-4 text-sm text-slate-500" role="status">Loading your content…</p> : currentItems.length === 0 ? <p className="mt-4 text-sm text-slate-500">You haven’t added any {kind}s yet.</p> : <ul className="mt-4 divide-y divide-slate-100">{currentItems.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.archivedAt ? 'Archived' : item.targetMuscleGroup ?? item.type ?? item.category ?? kind}</p></div><div className="flex gap-2"><button type="button" disabled={pending || Boolean(item.archivedAt)} onClick={() => void edit(item)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50"><Pencil size={13} />Edit</button><button type="button" disabled={pending || Boolean(item.archivedAt)} onClick={() => void archive(item)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-rose-700 disabled:opacity-50"><Archive size={13} />Archive</button></div></li>)}</ul>}</section></div>
  </div></main>
}
