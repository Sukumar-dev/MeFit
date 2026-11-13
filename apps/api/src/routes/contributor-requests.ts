import { Router } from 'express'
import { ContributorRequestStatus, Role } from '../generated/prisma/client.js'
import { requireAuth, requireRole } from '../auth/authorization.js'
import { prisma } from '../db.js'
import { z } from 'zod'

const router = Router()
const createSchema = z.object({ message: z.string().trim().max(1000).optional() }).strict()
const reviewSchema = z.object({ status: z.enum([ContributorRequestStatus.APPROVED, ContributorRequestStatus.REJECTED]) }).strict()

router.post('/contributor-request', requireAuth, async (request, response, next) => {
  const parsed = createSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Request message must be 1,000 characters or fewer.' } })
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, include: { roles: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    if (user.roles.some(({ role }) => role === Role.CONTRIBUTOR || role === Role.ADMIN)) return response.status(409).json({ error: { code: 'ALREADY_CONTRIBUTOR', message: 'Your account already has contributor access.' } })
    const current = await prisma.contributorRequest.findFirst({ where: { userId: user.id, status: ContributorRequestStatus.PENDING }, orderBy: { createdAt: 'desc' } })
    if (current) return response.status(200).json({ id: current.id, status: current.status, message: current.message })
    const item = await prisma.contributorRequest.create({ data: { userId: user.id, message: parsed.data.message ?? null } })
    response.status(201).location(`${process.env.API_PUBLIC_ORIGIN ?? 'http://localhost:4000'}/api/contributor-request/${item.id}`).json({ id: item.id, status: item.status, created_at: item.createdAt })
  } catch (error) { next(error) }
})

router.get('/contributor-request', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!user) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const items = await prisma.contributorRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, message: true, createdAt: true, reviewedAt: true } })
    response.json({ requests: items })
  } catch (error) { next(error) }
})

router.get('/admin/contributor-requests', requireAuth, requireRole('ADMIN'), async (request, response, next) => {
  try {
    const items = await prisma.contributorRequest.findMany({ where: { status: ContributorRequestStatus.PENDING }, include: { user: { select: { id: true, email: true, displayName: true } } }, orderBy: { createdAt: 'asc' } })
    response.json({ requests: items.map((item) => ({ id: item.id, message: item.message, created_at: item.createdAt, user: item.user })) })
  } catch (error) { next(error) }
})

router.patch('/admin/contributor-requests/:request_id', requireAuth, requireRole('ADMIN'), async (request, response, next) => {
  const parsed = reviewSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Choose APPROVED or REJECTED.' } })
  try {
    const requestId = request.params.request_id as string
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const existing = await prisma.contributorRequest.findUnique({ where: { id: requestId }, select: { id: true, userId: true, status: true } })
    if (!existing) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The contributor request was not found.' } })
    if (existing.status !== ContributorRequestStatus.PENDING) return response.status(409).json({ error: { code: 'ALREADY_REVIEWED', message: 'This contributor request has already been reviewed.' } })
    const item = await prisma.$transaction(async (tx) => {
      const reviewed = await tx.contributorRequest.update({ where: { id: requestId }, data: { status: parsed.data.status, reviewerId: actor.id, reviewedAt: new Date() } })
      if (parsed.data.status === ContributorRequestStatus.APPROVED) await tx.userRole.upsert({ where: { userId_role: { userId: existing.userId, role: Role.CONTRIBUTOR } }, create: { userId: existing.userId, role: Role.CONTRIBUTOR }, update: {} })
      await tx.auditLog.create({ data: { actorId: actor.id, action: `CONTRIBUTOR_REQUEST_${parsed.data.status}`, targetType: 'ContributorRequest', targetId: requestId, metadata: { user_id: existing.userId } } })
      return reviewed
    })
    response.json({ id: item.id, status: item.status, reviewed_at: item.reviewedAt })
  } catch (error) { next(error) }
})

export default router
