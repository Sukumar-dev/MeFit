import { srsApiUrl } from '../auth/api'
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Activity, CalendarDays, ChartNoAxesCombined, Dumbbell, House, LogOut, Settings, Timer, X, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mf-card p-5 sm:p-6 ${className}`}>{children}</section>
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button {...props} className={`mf-button mf-button-${variant} ${className}`} />
}

export function Badge({ children, warm }: { children: ReactNode; warm?: boolean }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: warm ? 'var(--mf-accent-bg)' : 'var(--mf-mint)', color: warm ? 'var(--mf-accent)' : 'var(--mf-green)' }}>{children}</span>
}

export function StatCard({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return <Card className="space-y-2"><Icon aria-hidden className="size-5 text-[var(--mf-green)]" /><p className="mf-muted text-sm font-medium">{label}</p><p className="text-2xl font-bold tracking-tight">{value}</p><p className="mf-muted text-xs">{detail}</p></Card>
}

export function ProgressRing({ complete, total }: { complete: number; total: number }) {
  const percent = total ? Math.round(100 * complete / total) : 0
  return <div className="relative grid size-36 place-items-center" role="img" aria-label={`${complete} of ${total} workouts completed`}>
    <svg className="absolute inset-0 size-full" viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--mf-border)" strokeWidth="9" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--mf-green)" strokeWidth="9" pathLength="100" strokeDasharray={`${percent} 100`} strokeLinecap="round" transform="rotate(-90 60 60)" />
    </svg>
    <div className="text-center"><strong className="block text-xl">{complete} of {total}</strong><span className="mf-muted text-xs">workouts</span></div>
  </div>
}

export function Skeleton() {
  return <div role="status" className="grid gap-4 sm:grid-cols-2"><span className="sr-only">Loading your fitness data</span>{[0, 1, 2, 3].map((item) => <div key={item} className="mf-card h-36 animate-pulse" aria-hidden />)}</div>
}

export function Toast({ children }: { children: ReactNode }) {
  return <p role="status" className="fixed right-4 bottom-24 z-40 max-w-[calc(100vw-2rem)] rounded-xl bg-[#075343] px-4 py-3 font-medium text-white shadow-lg lg:bottom-5">{children}</p>
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="grid justify-items-center gap-2 py-6 text-center">
    <svg aria-hidden width="84" height="64" viewBox="0 0 84 64"><rect x="14" y="9" width="56" height="47" rx="12" fill="#d9efe3" /><path d="M25 34h9l6-11 7 22 5-11h8" fill="none" stroke="#075343" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="68" cy="12" r="5" fill="#ed9877" /></svg>
    <h3 className="font-semibold">{title}</h3>{children}
  </div>
}

export function Drawer({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} onClose={close} aria-labelledby="fitness-drawer-title" className="mf-card text-inherit fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-xl overflow-y-auto rounded-none p-5 backdrop:bg-black/50 sm:p-8">
    <div className="mb-5 flex items-start justify-between gap-4"><h2 id="fitness-drawer-title" className="text-2xl font-bold">{title}</h2><Button autoFocus type="button" variant="ghost" aria-label="Close drawer" onClick={() => ref.current?.close()}><X aria-hidden /></Button></div>{children}
  </dialog>
}

const nav = [['Dashboard', '/#dashboard', House], ['Planner', '/#planner', CalendarDays], ['Library', '/catalog', Dumbbell], ['Logging', '/#logging', Timer], ['Progress', '/#progress', ChartNoAxesCombined], ['Settings', '/#settings', Settings]] as const

export function WorkspaceNav({ name, roles, signOut }: { name: string; roles: string[]; signOut: () => void }) {
  const accountMenu = useRef<HTMLDetailsElement>(null)
  function closeAccountMenu() {
    accountMenu.current?.removeAttribute('open')
  }
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'M'
  return <>
    <header className="sticky top-0 z-30 border-b border-[var(--mf-border)] bg-[var(--mf-card)]">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link to="/#dashboard" className="flex items-center gap-2 text-xl font-bold"><span className="grid size-9 place-items-center rounded-xl bg-[#075343] text-white"><Activity aria-hidden size={19} /></span>MeFit</Link>
        <nav aria-label="Fitness workspace" className="mf-nav hidden gap-1 text-sm font-semibold lg:flex">{nav.map(([label, href, Icon]) => <Link key={label} to={href}><Icon aria-hidden size={17} />{label}</Link>)}</nav>
        <details ref={accountMenu} className="relative"><summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full bg-[var(--mf-mint)] text-sm font-bold text-[var(--mf-green)]" aria-label="Account menu">{initials}</summary>
          <div className="mf-card absolute top-full right-0 mt-2 grid min-w-40 gap-1 p-2"><Link to="/#settings" onClick={closeAccountMenu} className="mf-button mf-button-ghost">Settings</Link>{srsApiUrl && (roles.includes('CONTRIBUTOR') || roles.includes('ADMIN')) && <Link to="/contribute" onClick={closeAccountMenu} className="mf-button mf-button-ghost">Contributors area</Link>}{srsApiUrl && roles.includes('ADMIN') && <Link to="/admin" onClick={closeAccountMenu} className="mf-button mf-button-ghost">Administration</Link>}<Button variant="ghost" onClick={signOut}><LogOut aria-hidden size={17} />Sign out</Button></div>
        </details>
      </div>
    </header>
    <nav aria-label="Mobile fitness workspace" className="mf-mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--mf-border)] bg-[var(--mf-card)] px-2 pt-1 text-[11px] font-semibold lg:hidden">{nav.slice(0, 5).map(([label, href, Icon]) => <Link key={label} to={href} className="grid min-h-12 justify-items-center gap-1 rounded-lg p-1 text-[var(--mf-green)]"><Icon aria-hidden size={19} />{label}</Link>)}</nav>
  </>
}
