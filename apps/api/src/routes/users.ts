import { Router } from 'express'
import { Role } from '../generated/prisma/client.js'
import { hasRole, requireAuth, requireRole } from '../auth/authorization.js'
import { prisma } from '../db.js'
import { z } from 'zod'
import { linkSupabaseIdentity } from '../auth/link-account.js'

const router = Router()
const userUpdateSchema = z.object({ display_name: z.string().trim().min(1).max(120) }).strict()
const roleUpdateSchema = z.object({ roles: z.array(z.enum([Role.USER, Role.CONTRIBUTOR, Role.ADMIN])).min(1).max(3) }).strict()

async function viewerIsAdmin(subject: string, tokenRoles: readonly string[]) {
  if (hasRole(tokenRoles, 'ADMIN')) return true
  const viewer = await prisma.user.findUnique({ where: { oidcSubject: subject }, select: { roles: { select: { role: true } } } })
  return hasRole(viewer?.roles.map(({ role }) => role) ?? [], 'ADMIN')
}

const linkedAccountRequired = { error: { code: 'ACCOUNT_LINK_REQUIRED', message: 'Connect your existing MeFit sign-in before continuing.' } }

router.post('/user/link', requireAuth, linkSupabaseIdentity)

router.post('/user', requireAuth, async (request, response, next) => {
  try {
    const auth = request.auth!
    const existing = await prisma.user.findUnique({ where: { oidcSubject: auth.subject }, include: { roles: true, profile: { select: { id: true } } } })
    if (!existing && auth.supabaseIdentity) {
      const priorAccount = await prisma.user.findFirst({ where: { email: { equals: auth.email, mode: 'insensitive' } }, select: { id: true } })
      if (priorAccount) {
        response.status(409).json(linkedAccountRequired)
        return
      }
    }
    if (existing?.disabledAt) {
      response.status(403).json({ error: { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled. Contact an administrator.' } })
      return
    }
    const allowedRoles = [...new Set([...auth.roles, ...(existing?.roles.map(({ role }) => role) ?? [])].filter((role): role is Role => role === Role.USER || role === Role.CONTRIBUTOR || role === Role.ADMIN))]
    if (!allowedRoles.length) allowedRoles.push(Role.USER)

    const user = auth.supabaseIdentity?.linked && existing ? existing : await prisma.$transaction(async (transaction) => {
      const savedUser = await transaction.user.upsert({
        where: { oidcSubject: auth.subject },
        create: { oidcSubject: auth.subject,
          ...(process.env.AUTH_PROVIDER === 'dual' && auth.supabaseIdentity ? {
            supabaseIdentity: { create: { issuer: auth.supabaseIdentity.issuer, subject: auth.supabaseIdentity.subject } },
          } : {}),
          email: auth.email, displayName: auth.displayName, firstName: auth.firstName ?? null, lastName: auth.lastName ?? null },
        update: {
          email: auth.email,
          ...(auth.displayName ? { displayName: auth.displayName } : {}),
          ...(auth.firstName || auth.lastName ? {
            firstName: auth.firstName ?? existing?.firstName ?? null,
            lastName: auth.lastName ?? existing?.lastName ?? null,
          } : {}),
        },
      })
      await transaction.userRole.deleteMany({ where: { userId: savedUser.id } })
      await transaction.userRole.createMany({ data: allowedRoles.map((role) => ({ userId: savedUser.id, role })) })
      return transaction.user.findUniqueOrThrow({
        where: { id: savedUser.id },
        include: { roles: true, profile: { select: { id: true } } },
      })
    })

    response.status(existing ? 200 : 201)
    if (!existing) response.location(`${process.env.API_PUBLIC_ORIGIN ?? 'http://localhost:4000'}/api/user/${user.id}`)
    response.json({
      id: user.id,
      email: user.email,
      display_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || (user.displayName !== user.email ? user.displayName : ''),
      first_name: user.firstName,
      last_name: user.lastName,
      roles: user.roles.map(({ role }) => role),
      has_profile: Boolean(user.profile),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/user', requireAuth, async (request, response, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true, disabledAt: true } })
    if (!user) {
      response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup before continuing.' } })
      return
    }
    if (user.disabledAt) {
      response.status(403).json({ error: { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled. Contact an administrator.' } })
      return
    }
    response.redirect(303, `${process.env.API_PUBLIC_ORIGIN ?? 'http://localhost:4000'}/api/user/${user.id}`)
  } catch (error) {
    next(error)
  }
})

router.get('/user/:user_id', requireAuth, async (request, response, next) => {
  try {
    const routeUserId = request.params.user_id
    const userId = Array.isArray(routeUserId) ? routeUserId[0] : routeUserId
    if (typeof userId !== 'string') {
      response.status(400).json({ error: { code: 'INVALID_USER_ID', message: 'The supplied user identifier is invalid.' } })
      return
    }
    const viewer = request.auth!
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, profile: { select: { id: true } } },
    })
    if (!user) {
      response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested user was not found.' } })
      return
    }
    const isSelf = user.oidcSubject === viewer.subject
    const isAdmin = await viewerIsAdmin(viewer.subject, viewer.roles)
    if (!isSelf && !isAdmin) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to view this user.' } })
      return
    }
    response.json({
      id: user.id,
      email: user.email,
      display_name: [user.firstName, user.lastName].filter(Boolean).join(' ') || (user.displayName !== user.email ? user.displayName : ''),
      first_name: user.firstName,
      last_name: user.lastName,
      roles: user.roles.map(({ role }) => role),
      has_profile: Boolean(user.profile),
      created_at: user.createdAt,
    })
  } catch (error) {
    next(error)
  }
})

router.patch('/user/:user_id', requireAuth, async (request, response, next) => {
  const parsed = userUpdateSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Provide a valid display_name. Passwords are changed through the identity provider.' } })
  try {
    const auth = request.auth!
    const routeId = request.params.user_id as string
    // The preserved frontend uses its Supabase subject in the display-name URL.
    const ownLegacyFrontendAlias = process.env.AUTH_PROVIDER === 'dual' && auth.supabaseIdentity?.linked &&
      routeId === auth.supabaseIdentity.subject
    const target = await prisma.user.findUnique({
      where: ownLegacyFrontendAlias ? { oidcSubject: auth.subject } : { id: routeId },
      select: { id: true, oidcSubject: true },
    })
    if (!target) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested user was not found.' } })
    if (target.oidcSubject !== request.auth!.subject && !(await viewerIsAdmin(request.auth!.subject, request.auth!.roles))) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may update only your own account.' } })
    const [firstName, ...lastNameParts] = parsed.data.display_name.split(/\s+/)
    const user = await prisma.user.update({ where: { id: target.id }, data: { displayName: parsed.data.display_name, firstName: firstName ?? null, lastName: lastNameParts.join(' ') || null }, select: { id: true, email: true, displayName: true, firstName: true, lastName: true, updatedAt: true } })
    response.json({ id: user.id, email: user.email, display_name: user.displayName, first_name: user.firstName, last_name: user.lastName, updated_at: user.updatedAt })
  } catch (error) { next(error) }
})

router.patch('/admin/user/:user_id/roles', requireAuth, requireRole('ADMIN'), async (request, response, next) => {
  const parsed = roleUpdateSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Provide one or more valid roles.' } })
  try {
    const userId = request.params.user_id as string
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!target) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested user was not found.' } })
    const requestedRoles = [...new Set(parsed.data.roles)]
    if (!requestedRoles.includes(Role.USER)) requestedRoles.push(Role.USER)
    const result = await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } })
      await tx.userRole.createMany({ data: requestedRoles.map((role) => ({ userId, role })) })
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'USER_ROLES_UPDATED', targetType: 'User', targetId: userId, metadata: { roles: requestedRoles } } })
      return tx.userRole.findMany({ where: { userId }, select: { role: true } })
    })
    response.json({ user_id: userId, roles: result.map(({ role }) => role) })
  } catch (error) { next(error) }
})

router.get('/admin/users', requireAuth, requireRole('ADMIN'), async (_request, response, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, include: { roles: { select: { role: true } }, profile: { select: { fitnessLevel: true } } } })
    response.json({ users: users.map((user) => ({ id: user.id, email: user.email, display_name: user.displayName, roles: user.roles.map(({ role }) => role), fitness_level: user.profile?.fitnessLevel ?? null, disabled: Boolean(user.disabledAt), created_at: user.createdAt })) })
  } catch (error) { next(error) }
})

router.post('/user/:user_id/update_password', requireAuth, async (request, response, next) => {
  try {
    const userId = request.params.user_id as string
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { oidcSubject: true } })
    if (!target) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested user was not found.' } })
    if (target.oidcSubject !== request.auth!.subject && !(await viewerIsAdmin(request.auth!.subject, request.auth!.roles))) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may change only your own password.' } })
    if (request.auth!.supabaseIdentity) {
      response.status(303).location(`${(process.env.WEB_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '')}/login`).end()
      return
    }
    const issuer = process.env.OIDC_ISSUER
    if (!issuer) return response.status(503).json({ error: { code: 'IDENTITY_UNAVAILABLE', message: 'Password management is temporarily unavailable.' } })
    response.status(303).location(`${issuer.replace(/\/$/, '')}/account/#/security/signingin`).end()
  } catch (error) { next(error) }
})

router.delete('/user/:user_id', requireAuth, async (request, response, next) => {
  try {
    const userId = request.params.user_id as string
    const actor = await prisma.user.findUnique({ where: { oidcSubject: request.auth!.subject }, select: { id: true } })
    if (!actor) return response.status(404).json({ error: { code: 'USER_NOT_REGISTERED', message: 'Complete account setup first.' } })
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, oidcSubject: true, disabledAt: true } })
    if (!target) return response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested user was not found.' } })
    if (target.oidcSubject !== request.auth!.subject && !(await viewerIsAdmin(request.auth!.subject, request.auth!.roles))) return response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You may delete only your own account.' } })
    await prisma.$transaction(async (tx) => {
      if (!target.disabledAt) await tx.user.update({ where: { id: userId }, data: { disabledAt: new Date() } })
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'USER_DISABLED', targetType: 'User', targetId: userId } })
    })
    response.sendStatus(204)
  } catch (error) { next(error) }
})

export default router
