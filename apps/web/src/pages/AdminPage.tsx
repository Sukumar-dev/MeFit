import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, ShieldCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authenticatedRequest } from '../auth/api'

type RequestItem = { id: string; message: string | null; created_at: string; user: { id: string; email: string; displayName: string } }
type UserItem = { id: string; email: string; display_name: string; roles: string[]; disabled: boolean; fitness_level: string | null }

export function AdminPage() {
  const { session } = useAuth()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [users, setUsers] = useState<UserItem[]>([])
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!session) return
    try {
      const [r, u] = await Promise.all([
        authenticatedRequest(`/admin/contributor-requests`, session).then(async (response) => { const result = await response.json() as { requests?: RequestItem[]; error?: { message?: string } }; if (!response.ok) throw new Error(result.error?.message ?? 'Could not load requests.'); return result }),
        authenticatedRequest(`/admin/users`, session).then(async (response) => { const result = await response.json() as { users?: UserItem[]; error?: { message?: string } }; if (!response.ok) throw new Error(result.error?.message ?? 'Could not load accounts.'); return result }),
      ])
      setRequests(r.requests ?? []); setUsers(u.users ?? [])
      setSelected(Object.fromEntries((u.users ?? []).map((user) => [user.id, user.roles])))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Admin data could not be loaded.') }
    finally { setLoading(false) }
  }, [session])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer) }, [load])

  async function review(item: RequestItem, status: 'APPROVED' | 'REJECTED') {
    if (!session) return
    setPending(item.id); setError(null); setMessage(null)
    try {
      const response = await authenticatedRequest(`/admin/contributor-requests/${item.id}`, session, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const result = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'The request could not be reviewed.')
      setMessage(`Contributor request ${status.toLowerCase()}.`); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request could not be reviewed.') }
    finally { setPending(null) }
  }

  async function saveRoles(user: UserItem) {
    if (!session) return
    setPending(user.id); setError(null); setMessage(null)
    try {
      const response = await authenticatedRequest(`/admin/user/${user.id}/roles`, session, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roles: selected[user.id] ?? ['USER'] }) })
      const result = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(result.error?.message ?? 'Roles could not be updated.')
      setMessage(`Roles updated for ${user.email}.`); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Roles could not be updated.') }
    finally { setPending(null) }
  }

  return <main className="min-h-screen bg-[#f3f7f5] px-4 py-8 text-slate-900 sm:px-6"><div className="mx-auto max-w-6xl"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 hover:underline"><ArrowLeft size={16} />Dashboard</Link><header className="mt-6"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700"><ShieldCheck size={15} />Administration</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Manage access and requests</h1></header>{error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}{message && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{message}</p>}{loading ? <p className="mt-7 rounded-2xl bg-white p-6 text-sm text-slate-600" role="status">Loading administration data…</p> : <div className="mt-7 space-y-7"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Contributor requests <span className="ml-1 text-sm font-normal text-slate-500">({requests.length} pending)</span></h2>{requests.length === 0 ? <p className="mt-4 text-sm text-slate-500">No requests need review.</p> : <ul className="mt-4 divide-y divide-slate-100">{requests.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{item.user.displayName} <span className="font-normal text-slate-500">· {item.user.email}</span></p><p className="mt-1 text-sm text-slate-600">{item.message || 'No message supplied.'}</p></div><div className="flex gap-2"><button type="button" disabled={pending === item.id} onClick={() => void review(item, 'APPROVED')} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-900 px-3 text-sm font-semibold text-white disabled:opacity-60"><Check size={15} />Approve</button><button type="button" disabled={pending === item.id} onClick={() => void review(item, 'REJECTED')} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60"><X size={15} />Reject</button></div></li>)}</ul>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-semibold">Accounts <span className="ml-1 text-sm font-normal text-slate-500">({users.length})</span></h2><div className="mt-4 divide-y divide-slate-100">{users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-semibold">{user.display_name}</p><p className="mt-1 text-sm text-slate-500">{user.email}{user.disabled ? ' · Disabled' : ''}{user.fitness_level ? ` · ${user.fitness_level}` : ''}</p></div><div className="flex flex-wrap items-center gap-3">{(['USER', 'CONTRIBUTOR', 'ADMIN'] as const).map((role) => <label key={role} className="flex items-center gap-1.5 text-xs font-medium"><input type="checkbox" checked={(selected[user.id] ?? user.roles).includes(role)} disabled={user.disabled} onChange={(event) => setSelected((state) => ({ ...state, [user.id]: event.target.checked ? [...new Set([...(state[user.id] ?? user.roles), role])] : (state[user.id] ?? user.roles).filter((value) => value !== role) }))} />{role}</label>)}<button type="button" disabled={pending === user.id || user.disabled} onClick={() => void saveRoles(user)} className="min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50">Save roles</button></div></div>)}</div></section></div>}</div></main>
}
