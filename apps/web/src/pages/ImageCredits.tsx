import { Link } from 'react-router-dom'
import { Card } from '../components/FitnessDesign'

const credits = [
  ['Gym training', 'Leon Ardho', 'woman-lifting-barbell-1552249'],
  ['Track training', 'Andrea Piacquadio', 'strong-sportsmen-ready-for-running-on-stadium-3764011'],
  ['Floor exercise', 'Pixabay', '416778'],
  ['Suspension training', 'Pixabay', 'woman-doing-exercise-414029'],
  ['Indoor yoga', 'cottonbro studio', 'woman-girl-morning-sport-4056536'],
  ['Sunrise stretching', 'Andrea Piacquadio', 'man-doing-daily-exercise-3772502'],
  ['Dumbbell rack', 'Pexels', '4164766'],
  ['Salad bowl', 'Ella Olsson', '1640777'],
]

export function ImageCredits() {
  return <main className="mf-page min-h-screen px-5 py-12">
    <div className="mx-auto max-w-xl space-y-4">
      <Link to="/" className="mf-button mf-button-secondary">Back to MeFit</Link>
      <Card><h1 className="text-3xl font-bold">Image credits</h1>
        <ul className="mt-4 space-y-3">{credits.map(([title, author, slug]) => <li key={slug}><a className="underline" href={`https://www.pexels.com/photo/${slug}/`}>{title} by {author}</a></li>)}</ul>
        <p className="mf-muted mt-5">Editorial photographs are used under the <a className="underline" href="https://www.pexels.com/license/">Pexels license</a>. Exercise photos come from <a className="underline" href="https://github.com/yuhonas/free-exercise-db">Free Exercise DB</a>.</p>
      </Card>
    </div>
  </main>
}
