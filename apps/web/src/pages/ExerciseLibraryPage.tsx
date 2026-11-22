import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Activity, ArrowLeft, ArrowRight, Dumbbell, Footprints, Heart, Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/FitnessDesign'
import { useAuth } from '../auth/AuthContext'
import { getSupabaseClient } from '../auth/supabase'
import { bodyAreas, equipmentOptions, levels, movements, filterExercises, type Exercise } from './exerciseFilters'

const pageSize = 12
const field = 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-600 dark:bg-slate-900'
const chip = 'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-medium aria-pressed:border-teal-700 aria-pressed:bg-teal-800 aria-pressed:text-white dark:border-slate-600'
const action = 'min-h-11 rounded-xl bg-teal-800 px-4 font-semibold text-white hover:bg-teal-700 disabled:opacity-50'

function ExerciseImage({ row, index = 0 }: { row: Exercise; index?: number }) {
  const src = row.image_paths[index]
  const [failed, setFailed] = useState('')
  const Icon = ['Cardio', 'Legs & Glutes'].includes(row.body_area) ? Footprints : row.body_area === 'Mobility & Stretching' ? Activity : Dumbbell
  return <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-teal-50 dark:bg-teal-950">
    {src && failed !== src ? <img src={src} alt={row.name + (row.image_paths.length > 1 ? ` — position ${index + 1}` : '')} loading="lazy" width={600} height={450} onError={() => setFailed(src)} className="h-full w-full object-contain" /> : <Icon aria-hidden className="size-12 text-teal-700 dark:text-teal-300" />}
  </div>
}

function Badges({ row }: { row: Exercise }) {
  return <div className="flex flex-wrap gap-2 text-xs">
    {[row.primary_muscles[0] || row.body_area, ...row.equipment, row.level].map((label) => <span key={label} className="rounded-full bg-teal-50 px-2.5 py-1 font-medium capitalize text-teal-900 dark:bg-teal-950 dark:text-teal-100">{label}</span>)}
  </div>
}

export function ExerciseLibraryPage() {
  const { session } = useAuth()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [search, setSearch] = useState(query)
  const [rows, setRows] = useState<Exercise[] | null>(null)
  const [favorites, setFavorites] = useState(new Set<string>())
  const [limit, setLimit] = useState(pageSize)
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const db = getSupabaseClient()
  const userId = session?.user.id

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      db.from('exercise_library').select('*').order('name').abortSignal(controller.signal),
      db.from('user_favorites').select('exercise_id').abortSignal(controller.signal),
    ]).then(([catalog, saved]) => {
      if (controller.signal.aborted) return
      if (catalog.error || saved.error) { setLoadError(true); return }
      setRows(catalog.data)
      setFavorites(new Set(saved.data.map((item) => item.exercise_id)))
      setLoadError(false)
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true) })
    return () => controller.abort()
  }, [db, attempt, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (query === search) return
      setParams((previous) => {
        const next = new URLSearchParams(previous)
        if (search) next.set('q', search)
        else next.delete('q')
        return next
      }, { replace: true })
      setLimit(pageSize)
    }, 240)
    return () => window.clearTimeout(timer)
  }, [query, search, setParams])

  function change(key: string, value: string, multiple = false) {
    const next = new URLSearchParams(params)
    if (multiple) {
      const values = next.getAll(key)
      next.delete(key)
      for (const item of values.includes(value) ? values.filter((item) => item !== value) : [...values, value]) next.append(key, item)
    } else if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
    setLimit(pageSize)
  }

  function clear() {
    setSearch('')
    setParams(params.get('tab') === 'favorites' ? { tab: 'favorites' } : {})
    setLimit(pageSize)
  }

  async function toggle(row: Exercise) {
    if (!userId || saving) return
    setSaving(true)
    setNotice('')
    const active = favorites.has(row.id)
    try {
      const { error } = await (active
        ? db.from('user_favorites').delete().eq('exercise_id', row.id).eq('user_id', userId)
        : db.from('user_favorites').insert({ exercise_id: row.id, user_id: userId }))
      if (error) throw error
      setFavorites((previous) => {
        const next = new Set(previous)
        if (active) next.delete(row.id)
        else next.add(row.id)
        return next
      })
      setNotice(active ? 'Removed from favorites.' : 'Added to favorites.')
    } catch { setNotice('Could not update favorites. Please try again.') }
    finally { setSaving(false) }
  }

  async function addToPlan(event: FormEvent<HTMLFormElement>, row: Exercise) {
    event.preventDefault()
    const date = String(new FormData(event.currentTarget).get('day') ?? '')
    setSaving(true)
    setNotice('')
    try {
      const { error } = await db.from('weekly_workouts').insert({ workout_date: date, title: row.legacy_names[0] || row.name })
      if (error) throw error
      setNotice('Added to your weekly plan.')
    } catch { setNotice('Could not add this exercise. Please try again.') }
    finally { setSaving(false) }
  }

  const results = filterExercises(rows ?? [], params, favorites)
  const activeFilters = [...params.entries()].filter(([key]) => !['tab', 'q'].includes(key))
  const favoriteTab = params.get('tab') === 'favorites'

  return <main className="min-h-screen bg-[#f3f7f5] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-7xl space-y-5 px-5 py-8 sm:px-8">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-teal-800 dark:text-teal-200"><ArrowLeft size={18} aria-hidden /> Dashboard</Link>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Exercise library</h1>
      <label className="relative block max-w-xl"><span className="sr-only">Search by exercise or muscle</span><Search aria-hidden className="absolute left-3 top-3 size-5" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises or muscles" className={field + ' w-full pl-10'} /></label>
      <div role="group" aria-label="Body area" className="flex gap-2 overflow-x-auto pb-2">
        {['All', ...bodyAreas].map((area) => {
          const Icon = ['Cardio', 'Legs & Glutes'].includes(area) ? Footprints : area === 'Mobility & Stretching' ? Activity : Dumbbell
          return <button key={area} className={chip} aria-pressed={(params.get('area') ?? 'All') === area} onClick={() => change('area', area === 'All' ? '' : area)}><Icon aria-hidden size={16} />{area}</button>
        })}
      </div>
      <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <summary className="cursor-pointer font-semibold"><SlidersHorizontal aria-hidden className="mr-2 inline size-4" />Filters</summary>
        <fieldset className="mt-4"><legend className="text-sm font-semibold">Equipment</legend><div className="flex flex-wrap gap-3">{equipmentOptions.map((item) => <label key={item} className="inline-flex min-h-10 items-center gap-2"><input type="checkbox" checked={params.getAll('equipment').includes(item)} onChange={() => change('equipment', item, true)} />{item}</label>)}</div></fieldset>
        <div className="flex flex-wrap gap-4">
          {[['Level', 'level', levels], ['Movement type', 'movement', movements]].map(([label, key, values]) => <label key={String(key)} className="grid gap-1 text-sm">{label}<select className={field} value={params.get(String(key)) ?? ''} onChange={(event) => change(String(key), event.target.value)}><option value="">All</option>{(values as string[]).map((value) => <option key={value}>{value}</option>)}</select></label>)}
        </div>
      </details>
      {(activeFilters.length > 0 || query) && <div className="flex flex-wrap gap-2">{activeFilters.map(([key, value]) => <button className={chip} key={key + value} aria-label={`Remove ${value} filter`} onClick={() => change(key, key === 'equipment' ? value : '', key === 'equipment')}>{value}<X size={15} aria-hidden /></button>)}<button className="min-h-10 px-3 underline" onClick={clear}>Clear all</button></div>}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 pb-3 dark:border-slate-700" role="group" aria-label="Library view">
        <button className={chip} aria-pressed={!favoriteTab} onClick={() => change('tab', '')}>All exercises</button>
        <button className={chip} aria-pressed={favoriteTab} onClick={() => change('tab', 'favorites')}><Heart aria-hidden size={16} /> Favorites</button>
        {rows && <p className="ml-auto text-sm" role="status">{results.length} {results.length === 1 ? 'exercise' : 'exercises'}</p>}
      </div>
      {!selected && notice && <p role="status">{notice}</p>}
      {loadError ? <div role="alert"><p>Could not load the exercise library.</p><button className={action} onClick={() => { setLoadError(false); setAttempt((value) => value + 1) }}>Try again</button></div> :
        !rows ? <div role="status"><span className="sr-only">Loading exercises</span><div aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-square animate-pulse rounded-2xl bg-teal-100 motion-reduce:animate-none dark:bg-slate-800" />)}</div></div> :
          !results.length ? <section className="rounded-2xl border border-dashed p-8 text-center"><EmptyState title={favoriteTab && !favorites.size ? 'No favorites yet.' : 'No exercises found.'}><button className="min-h-11 underline" onClick={favoriteTab && !favorites.size ? () => change('tab', '') : clear}>{favoriteTab && !favorites.size ? 'Browse exercises' : 'Clear filters'}</button></EmptyState></section> :
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{results.slice(0, limit).map((row) => <li key={row.id} className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <button className="block w-full rounded-xl text-left" onClick={() => { setNotice(''); setSelected(row) }}><ExerciseImage row={row} /><h2 className="mt-3 pr-2 font-semibold">{row.name}</h2></button>
              <div className="mt-2"><Badges row={row} /></div>
              <button className="absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-teal-900 dark:bg-slate-900 dark:text-teal-200" disabled={saving} aria-label={`Favorite ${row.name}`} aria-pressed={favorites.has(row.id)} onClick={() => void toggle(row)}><Heart aria-hidden size={19} fill={favorites.has(row.id) ? 'currentColor' : 'none'} /></button>
            </li>)}</ul>}
      {results.length > limit && <button className={action} onClick={() => setLimit((value) => value + pageSize)}>Load more</button>}
      <footer className="border-t border-slate-300 pt-4 text-sm dark:border-slate-700">Exercise data and photos from <a className="underline" href="https://github.com/yuhonas/free-exercise-db">Free Exercise DB</a> (public domain).</footer>
    </div>
    {selected && <ExerciseDetail row={selected} favorite={favorites.has(selected.id)} saving={saving} notice={notice} close={() => setSelected(null)} toggle={() => void toggle(selected)} add={(event) => void addToPlan(event, selected)} />}
  </main>
}

function ExerciseDetail({ row, close, favorite, toggle, saving, notice, add }: {
  row: Exercise; close: () => void; favorite: boolean; toggle: () => void; saving: boolean
  notice: string; add: (event: FormEvent<HTMLFormElement>) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [image, setImage] = useState(0)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} onClose={close} aria-labelledby="exercise-name" className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-lg overflow-y-auto bg-white p-5 text-slate-900 backdrop:bg-slate-950/55 dark:bg-slate-900 dark:text-slate-100">
    <div className="flex items-start justify-between gap-4"><h2 id="exercise-name" className="text-2xl font-semibold">{row.name}</h2><button autoFocus aria-label="Close exercise details" className="grid size-11 place-items-center rounded-full border" onClick={() => ref.current?.close()}><X aria-hidden /></button></div>
    <div className="my-4"><ExerciseImage row={row} index={image} /></div>
    {row.image_paths.length > 1 && <div className="mb-4 flex items-center gap-3"><button aria-label="Previous image" disabled={image === 0} className={chip} onClick={() => setImage(image - 1)}><ArrowLeft aria-hidden size={16} /></button><span>{image + 1} / {row.image_paths.length}</span><button aria-label="Next image" disabled={image === row.image_paths.length - 1} className={chip} onClick={() => setImage(image + 1)}><ArrowRight aria-hidden size={16} /></button></div>}
    <Badges row={row} />
    <dl className="my-4 space-y-2 text-sm"><div><dt className="font-semibold">Movement</dt><dd>{row.movement_type}</dd></div><div><dt className="font-semibold">Primary muscles</dt><dd className="capitalize">{row.primary_muscles.join(', ') || row.body_area}</dd></div>{row.secondary_muscles.length > 0 && <div><dt className="font-semibold">Secondary muscles</dt><dd className="capitalize">{row.secondary_muscles.join(', ')}</dd></div>}</dl>
    {row.instructions.length > 0 && <><h3 className="font-semibold">How to do it</h3><ol className="my-3 list-decimal space-y-2 pl-5">{row.instructions.map((step, index) => <li key={index}>{step}</li>)}</ol></>}
    <form className="my-4 flex flex-wrap items-end gap-3" onSubmit={add}><label className="grid gap-1">Choose day<input name="day" type="date" className={field} required /></label><button disabled={saving} className={action}>Add to my plan</button></form>
    <button className={chip} aria-pressed={favorite} disabled={saving} onClick={toggle}><Heart aria-hidden size={17} fill={favorite ? 'currentColor' : 'none'} />Favorite</button>
    {notice && <p className="my-3" role="status">{notice}</p>}
  </dialog>
}
