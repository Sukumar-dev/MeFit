import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Award } from 'lucide-react'
import { Badge, Card } from '../components/FitnessDesign'

type Log = { performed_on: string; exercise: string; weight_kg: number; reps: number }

export function TrainingProgress({ logs, pounds, today }: { logs: Log[]; pounds: boolean; today: Date }) {
  const dates = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - 27 + index)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const active = new Set(logs.map((log) => log.performed_on))
  const weeks = [0, 7, 14, 21].map((index) => ({
    week: dates[index].slice(5),
    days: dates.slice(index, index + 7).filter((date) => active.has(date)).length,
  }))
  const best = new Map<string, Log>()
  for (const log of logs) {
    const previous = best.get(log.exercise)
    if (!previous || previous.weight_kg < log.weight_kg || (previous.weight_kg === log.weight_kg && previous.reps < log.reps)) best.set(log.exercise, log)
  }
  const records = [...best.values()].sort((a, b) => b.weight_kg - a.weight_kg || b.reps - a.reps).slice(0, 3)
  return <div className="grid gap-4 lg:grid-cols-2">
    <Card><h3 className="font-bold">Training days</h3>
      {logs.length ? <div className="mt-3 h-44"><ResponsiveContainer><BarChart data={weeks} accessibilityLayer>
        <XAxis dataKey="week" tick={{ fill: 'var(--mf-muted)', fontSize: 12 }} /><YAxis allowDecimals={false} domain={[0, 7]} tick={{ fill: 'var(--mf-muted)', fontSize: 12 }} /><Tooltip contentStyle={{ background: 'var(--mf-card)', color: 'var(--mf-text)' }} />
        <Bar dataKey="days" name="Training days" fill="var(--mf-green)" radius={[6,6,0,0]} isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div> : <p className="mf-muted mt-3 text-sm">Your workouts will appear here after you log a set.</p>}
    </Card>
    <Card><h3 className="font-bold">Last 28 days</h3>
      <ul className="mt-4 grid max-w-80 grid-cols-7 gap-2">{dates.map((date) => <li key={date} className={`grid aspect-square place-items-center rounded-lg text-xs font-medium ${active.has(date) ? 'bg-[#075343] text-white' : 'bg-[var(--mf-mint)]'}`} aria-label={`${date}: ${active.has(date) ? 'trained' : 'no training recorded'}`}>{date.slice(-2)}</li>)}</ul>
    </Card>
    <Card className="lg:col-span-2"><h3 className="font-bold">Personal bests</h3>
      {records.length ? <ul className="mt-3 grid gap-3 md:grid-cols-3">{records.map((log) => <li key={log.exercise} className="rounded-xl border border-[var(--mf-border)] p-3"><Badge warm><Award aria-hidden size={15} />{log.exercise}</Badge><p className="mt-2 font-semibold">{(log.weight_kg * (pounds ? 2.2046226218 : 1)).toFixed(1)} {pounds ? 'lb' : 'kg'} · {log.reps} reps</p></li>)}</ul> : <p className="mf-muted mt-3 text-sm">Log a workout to start recording personal bests.</p>}
    </Card>
  </div>
}
