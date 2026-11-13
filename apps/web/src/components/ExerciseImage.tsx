import { useState } from 'react'

const exerciseImages: Record<string, string> = {
  '10000000-0000-4000-8000-000000000001': '/images/exercises/bodyweight-squat.webp',
  '10000000-0000-4000-8000-000000000002': '/images/exercises/glute-bridge.webp',
  '10000000-0000-4000-8000-000000000003': '/images/exercises/incline-push-up.webp',
  '10000000-0000-4000-8000-000000000004': '/images/exercises/bird-dog.webp',
  '10000000-0000-4000-8000-000000000005': '/images/exercises/dead-bug.webp',
  '10000000-0000-4000-8000-000000000006': '/images/exercises/step-back-lunge.webp',
  '10000000-0000-4000-8000-000000000007': '/images/exercises/march-in-place.webp',
  '10000000-0000-4000-8000-000000000008': '/images/exercises/wall-push-up.webp',
}

export function imageForExercise(id: string, imageUrl?: string | null): string {
  return imageUrl || exerciseImages[id] || '/images/exercises/fallback.svg'
}

export function ExerciseImage({ id, imageUrl, name, className = '' }: { id: string; imageUrl?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <img
    src={failed ? '/images/exercises/fallback.svg' : imageForExercise(id, imageUrl)}
    alt={`${name} exercise demonstration`}
    loading="lazy"
    decoding="async"
    onError={() => setFailed(true)}
    className={`aspect-[3/2] w-full rounded-xl border border-emerald-950/10 bg-emerald-50 object-contain ${className}`}
  />
}
