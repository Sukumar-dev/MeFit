import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { requireAuth } from '../auth/authorization.js'
import { prisma } from '../db.js'

const router = Router()
const profileSchema = z.object({
  timezone: z.string().min(1).max(80).default('UTC'),
  height_cm: z.number().min(80).max(250).nullable().optional(),
  weight_kg: z.number().min(25).max(350).nullable().optional(),
  activity_level: z.enum(['sedentary', 'light', 'moderate', 'high']).optional(),
  fitness_experience: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  profile_image_url: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Profile image URL must use HTTPS.').nullable().optional(),
  readiness: z.object({
    days_available: z.number().int().min(1).max(7),
    minutes_per_session: z.number().int().min(10).max(180),
    activity_level: z.enum(['sedentary', 'light', 'moderate', 'high']),
    experience: z.enum(['beginner', 'intermediate', 'advanced']),
    limitations: z.boolean(),
  }).strict(),
  address: z.object({
    line1: z.string().trim().min(1).max(160),
    line2: z.string().trim().max(160).optional(),
    line3: z.string().trim().max(160).optional(),
    postal_code: z.string().trim().max(24).optional(),
    city: z.string().trim().min(1).max(100),
    country: z.string().trim().min(2).max(80),
  }).strict().optional(),
}).strict()

function fitnessEvaluation(readiness: z.infer<typeof profileSchema>['readiness']) {
  const score = Math.min(100, 20 + readiness.days_available * 8 + Math.floor(readiness.minutes_per_session / 10) * 2 + ({ sedentary: 0, light: 8, moderate: 15, high: 20 }[readiness.activity_level]) + ({ beginner: 0, intermediate: 8, advanced: 12 }[readiness.experience]) - (readiness.limitations ? 8 : 0))
  const fitnessLevel = score < 45 ? 'FOUNDATION' : score < 70 ? 'BUILDING' : 'ESTABLISHED'
  return { score, fitness_level: fitnessLevel, version: 'mefit-readiness-v1', evaluated_at: new Date().toISOString(), suitability_warning: readiness.limitations ? 'You reported a limitation. Choose comfortable movements and consult a qualified professional if unsure.' : null, note: 'Planning guidance from self-reported answers; not a medical assessment.' }
}

router.get('/profile', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, include: { profile: { include: { address: true } } } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup before continuing.' } })
    if (!user.profile) return response.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Complete your fitness profile to continue.' } })
    response.json({
      id: user.profile.id,
      timezone: user.profile.timezone,
      height_cm: user.profile.heightCm,
      weight_kg: user.profile.weightKg,
      activity_level: user.profile.activityLevel,
      fitness_experience: user.profile.fitnessExperience,
      profile_image_url: user.profile.profileImageUrl,
      readiness: user.profile.readinessAnswers,
      fitness_level: user.profile.fitnessLevel,
      evaluation_version: user.profile.evaluationVersion,
      updated_at: user.profile.updatedAt,
      address: user.profile.address ? { line1: user.profile.address.line1, line2: user.profile.address.line2, line3: user.profile.address.line3, postal_code: user.profile.address.postalCode, city: user.profile.address.city, country: user.profile.address.country } : null,
    })
  } catch (error) { next(error) }
})

const saveProfile: RequestHandler = async (request, response, next) => {
  const parsed = profileSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Check the profile fields and try again.', details: parsed.error.flatten().fieldErrors } })
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true, disabledAt: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup before continuing.' } })
    if (user.disabledAt) return response.status(403).json({ error: { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled.' } })
    const evaluation = fitnessEvaluation(parsed.data.readiness)
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, timezone: parsed.data.timezone, heightCm: parsed.data.height_cm ?? null, weightKg: parsed.data.weight_kg ?? null, activityLevel: parsed.data.activity_level ?? parsed.data.readiness.activity_level, fitnessExperience: parsed.data.fitness_experience ?? parsed.data.readiness.experience, profileImageUrl: parsed.data.profile_image_url ?? null, readinessAnswers: { ...parsed.data.readiness, evaluation }, fitnessLevel: evaluation.fitness_level, evaluationVersion: evaluation.version },
        update: { timezone: parsed.data.timezone, heightCm: parsed.data.height_cm ?? null, weightKg: parsed.data.weight_kg ?? null, activityLevel: parsed.data.activity_level ?? parsed.data.readiness.activity_level, fitnessExperience: parsed.data.fitness_experience ?? parsed.data.readiness.experience, profileImageUrl: parsed.data.profile_image_url ?? null, readinessAnswers: { ...parsed.data.readiness, evaluation }, fitnessLevel: evaluation.fitness_level, evaluationVersion: evaluation.version },
      })
      if (parsed.data.address) {
        const address = parsed.data.address
        await tx.address.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id, line1: address.line1, line2: address.line2 ?? null, line3: address.line3 ?? null, postalCode: address.postal_code ?? null, city: address.city, country: address.country }, update: { line1: address.line1, line2: address.line2 ?? null, line3: address.line3 ?? null, postalCode: address.postal_code ?? null, city: address.city, country: address.country } })
      } else await tx.address.deleteMany({ where: { profileId: profile.id } })
      await tx.auditLog.create({ data: { actorId: user.id, action: 'PROFILE_UPSERTED', targetType: 'Profile', targetId: profile.id } })
      return profile
    })
    response.status(200).json({ id: result.id, fitness_level: evaluation.fitness_level, evaluation, message: 'Your profile has been saved.' })
  } catch (error) { next(error) }
}

router.post('/profile', requireAuth, saveProfile)
router.put('/profile', requireAuth, saveProfile)
router.patch('/profile', requireAuth, saveProfile)

router.delete('/profile', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, include: { profile: { select: { id: true } } } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    if (!user.profile) return response.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'No fitness profile exists.' } })
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: { actorId: user.id, action: 'PROFILE_DELETED', targetType: 'Profile', targetId: user.profile!.id } })
      await tx.profile.delete({ where: { id: user.profile!.id } })
    })
    response.sendStatus(204)
  } catch (error) { next(error) }
})

export default router
