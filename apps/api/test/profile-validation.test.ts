import { describe, expect, it } from 'vitest'
import { z } from 'zod'

const readinessSchema = z.object({
  days_available: z.number().int().min(1).max(7),
  minutes_per_session: z.number().int().min(10).max(180),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'high']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  limitations: z.boolean(),
}).strict()

function evaluate(input: z.infer<typeof readinessSchema>) {
  const score = Math.min(100, 20 + input.days_available * 8 + Math.floor(input.minutes_per_session / 10) * 2 + ({ sedentary: 0, light: 8, moderate: 15, high: 20 }[input.activity_level]) + ({ beginner: 0, intermediate: 8, advanced: 12 }[input.experience]) - (input.limitations ? 8 : 0))
  return { score, fitness_level: score < 45 ? 'FOUNDATION' : score < 70 ? 'BUILDING' : 'ESTABLISHED', suitability_warning: input.limitations ? 'warning' : null }
}

describe('fitness readiness profile validation and evaluation', () => {
  it('rejects unsafe or out-of-range readiness answers', () => {
    expect(readinessSchema.safeParse({ days_available: 0, minutes_per_session: 30, activity_level: 'light', experience: 'beginner', limitations: false }).success).toBe(false)
    expect(readinessSchema.safeParse({ days_available: 3, minutes_per_session: 30, activity_level: 'light<script>', experience: 'beginner', limitations: false }).success).toBe(false)
  })

  it('returns a capped, versionable planning score and a limitations reminder', () => {
    const result = evaluate(readinessSchema.parse({ days_available: 7, minutes_per_session: 180, activity_level: 'high', experience: 'advanced', limitations: true }))
    expect(result.score).toBe(100)
    expect(result.fitness_level).toBe('ESTABLISHED')
    expect(result.suitability_warning).toBe('warning')
  })
})
