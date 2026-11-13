import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseImage } from './ExerciseImage'

describe('ExerciseImage', () => {
  it('maps the exercise ID to its own lazy-loaded demonstration', () => {
    render(<ExerciseImage id="10000000-0000-4000-8000-000000000005" name="Dead Bug" />)
    const image = screen.getByRole('img', { name: 'Dead Bug exercise demonstration' })
    expect(image).toHaveAttribute('src', '/images/exercises/dead-bug.webp')
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it('uses the branded fallback when an image fails to load', () => {
    render(<ExerciseImage id="unknown" imageUrl="/missing.webp" name="New Exercise" />)
    const image = screen.getByRole('img', { name: 'New Exercise exercise demonstration' })
    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/images/exercises/fallback.svg')
  })
})
