import { Activity, CalendarDays, Dumbbell, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  { title: 'Plan your week', detail: 'Choose a start date and schedule workouts around the time you have.', icon: CalendarDays },
  { title: 'Find your next workout', detail: 'Browse exercises, workouts, and programs for your fitness goals.', icon: Dumbbell },
  { title: 'See your progress', detail: 'Record completed workouts and see how much of your plan you’ve finished.', icon: TrendingUp },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f3f7f5] text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold">
          <Activity aria-hidden="true" className="text-emerald-800" />MeFit
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/login" className="inline-flex min-h-11 items-center rounded-xl border border-emerald-900/20 px-4 font-semibold text-emerald-950 hover:bg-emerald-100">Sign in</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-12 px-5 pb-14 sm:px-8">
        <section className="rounded-3xl bg-emerald-950 px-6 py-14 text-white sm:px-12 sm:py-20">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Weekly fitness, with a plan.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-emerald-100">Build a workout routine that fits your week and keep track of what you complete.</p>
          <Link to="/register" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-lime-200 px-5 font-semibold text-emerald-950 hover:bg-lime-100">Create an account</Link>
        </section>
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl font-semibold">What you can do with MeFit</h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {features.map(({ title, detail, icon: Icon }) => (
              <li key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <Icon aria-hidden="true" className="text-emerald-800" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{detail}</p>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="getting-started-heading">
          <h2 id="getting-started-heading" className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 leading-7 text-slate-700">
            <li>Set up your fitness profile and tell MeFit how much time you have.</li>
            <li>Choose a goal and the workouts you want to do.</li>
            <li>Mark workouts complete and track your progress from the dashboard.</li>
          </ol>
        </section>
      </main>
      <footer className="border-t border-emerald-950/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <span className="font-semibold">MeFit</span>
          <Link to="/register" className="inline-flex min-h-11 items-center text-emerald-900 underline underline-offset-4">Get started</Link>
        </div>
      </footer>
    </div>
  )
}
