import { Activity, CalendarDays, Dumbbell, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'

const features = [
  { photo: 'training', alt: 'Runners at the starting line', title: 'Plan your week', detail: 'Choose a start date and schedule workouts around the time you have.', icon: CalendarDays },
  { photo: 'weights', alt: 'Dumbbells on a rack', title: 'Find your next workout', detail: 'Browse exercises, workouts, and programs for your fitness goals.', icon: Dumbbell },
  { photo: 'sunrise', alt: 'Athlete stretching outdoors at sunrise', title: 'See your progress', detail: 'Record completed workouts and see how much of your plan you’ve finished.', icon: TrendingUp },
]

export function LandingPage() {
  return (
    <div className="mf-page min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold">
          <Activity aria-hidden="true" className="text-[var(--mf-green)]" />MeFit
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/login" className="mf-button mf-button-secondary">Sign in</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-12 px-5 pb-14 sm:px-8">
        <section className="mf-dark-surface relative isolate overflow-hidden rounded-[20px] px-6 py-16 sm:px-12 sm:py-24">
          <img src="/images/editorial/gym.webp" alt="Athlete lifting a barbell in a gym" width={1600} height={1063} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-right" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-950 via-emerald-950/90 to-emerald-950/55" />
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Weekly fitness, with a plan.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-emerald-100">Build a workout routine that fits your week and keep track of what you complete.</p>
          <Link to="/register" className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-lime-200 px-5 font-semibold text-emerald-950 hover:bg-lime-100">Create an account</Link>
        </section>
        <section aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl font-semibold">What you can do with MeFit</h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {features.map(({ title, detail, photo, alt, icon: Icon }) => (
              <li key={title} className="mf-card overflow-hidden">
                <img src={`/images/editorial/${photo}-thumb.webp`} alt={alt} loading="lazy" width={480} height={320} className="aspect-[3/2] w-full object-cover" />
                <div className="p-5">
                <Icon aria-hidden="true" className="text-[var(--mf-green)]" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 leading-7 mf-muted">{detail}</p></div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="getting-started-heading">
          <h2 id="getting-started-heading" className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-6 leading-7 mf-muted">
            <li>Set up your fitness profile and tell MeFit how much time you have.</li>
            <li>Choose a goal and the workouts you want to do.</li>
            <li>Mark workouts complete and track your progress from the dashboard.</li>
          </ol>
        </section>
      </main>
      <footer className="border-t border-emerald-950/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4"><span className="font-semibold">MeFit</span><Link to="/credits" className="text-sm underline">Image credits</Link></div>
          <Link to="/register" className="inline-flex min-h-11 items-center text-[var(--mf-green)] underline underline-offset-4">Get started</Link>
        </div>
      </footer>
    </div>
  )
}
