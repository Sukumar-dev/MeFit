import type { RequestHandler } from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { z } from 'zod'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/client.js'

const legacyIssuer = process.env.OIDC_ISSUER
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY
const legacyAudience = process.env.OIDC_AUDIENCE ?? 'mefit-api'
const legacyKeys = legacyIssuer
  ? createRemoteJWKSet(new URL(`${legacyIssuer.replace(/\/$/, '')}/protocol/openid-connect/certs`), { timeoutDuration: 5000 })
  : undefined

const linkInput = z.object({ legacy_access_token: z.string().min(1).max(8192) }).strict()
const conflict = { error: { code: 'ACCOUNT_LINK_CONFLICT', message: 'One of these sign-ins is already connected to another account.' } }

export const linkSupabaseIdentity: RequestHandler = async (request, response, next) => {
  const auth = request.auth!
  const identity = auth.supabaseIdentity
  if (!identity) {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested endpoint was not found.' } })
    return
  }
  if (!legacyKeys || !legacyIssuer || !supabaseUrl || !supabaseKey) {
    response.status(503).json({ error: { code: 'ACCOUNT_LINK_UNAVAILABLE', message: 'Connecting an existing sign-in is temporarily unavailable.' } })
    return
  }
  const input = linkInput.safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Supply an active MeFit sign-in.' } })
    return
  }

  let legacySubject: string
  try {
    const { payload } = await jwtVerify(input.data.legacy_access_token, legacyKeys, {
      issuer: legacyIssuer,
      audience: legacyAudience,
      algorithms: ['RS256', 'ES256'],
      requiredClaims: ['exp', 'sub'],
    })
    if (!payload.sub || payload.sub.startsWith('supabase:')) throw new Error('Invalid legacy subject')
    legacySubject = payload.sub
  } catch {
    response.status(401).json({ error: { code: 'INVALID_LEGACY_SESSION', message: 'Sign in with your existing MeFit account again.' } })
    return
  }

  try {
    const { issuer, subject } = identity
    const account = await prisma.user.findUnique({
      where: { oidcSubject: legacySubject },
      select: { id: true, email: true, disabledAt: true, supabaseIdentity: { select: { issuer: true, subject: true } } },
    })
    if (!account || account.disabledAt) {
      response.status(403).json({ error: { code: 'ACCOUNT_LINK_FORBIDDEN', message: 'This MeFit account cannot be linked.' } })
      return
    }
    const currentLink = account.supabaseIdentity
    if (currentLink?.issuer === issuer && currentLink.subject === subject) {
      response.sendStatus(204)
      return
    }
    const existingSupabaseAccount = await prisma.user.findUnique({ where: { oidcSubject: subject }, select: { id: true } })
    if (currentLink || identity.linked || existingSupabaseAccount) {
      response.status(409).json(conflict)
      return
    }
    const verifiedIdentity = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization: request.header('authorization')! },
      signal: AbortSignal.timeout(5000),
    }).catch(() => null)
    if (!verifiedIdentity || verifiedIdentity.status >= 500 || verifiedIdentity.status === 429) {
      response.status(503).json({ error: { code: 'ACCOUNT_LINK_UNAVAILABLE', message: 'Email verification is temporarily unavailable.' } })
      return
    }
    const verifiedUser = verifiedIdentity.ok
      ? await verifiedIdentity.json() as { id?: string; email?: string; email_confirmed_at?: string | null }
      : null
    if (verifiedUser?.id !== subject || !verifiedUser.email_confirmed_at ||
        verifiedUser.email?.toLowerCase() !== account.email.toLowerCase()) {
      response.status(403).json({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify the email address associated with your existing MeFit account.' } })
      return
    }

    await prisma.supabaseIdentity.create({ data: { issuer, subject, userId: account.id } })
    response.sendStatus(204)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const link = await prisma.supabaseIdentity.findUnique({
        where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } },
        select: { user: { select: { oidcSubject: true, disabledAt: true } } },
      }).catch(() => null)
      if (link?.user.oidcSubject === legacySubject && !link.user.disabledAt) response.sendStatus(204)
      else response.status(409).json(conflict)
      return
    }
    next(error)
  }
}
