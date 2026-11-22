import type { RequestHandler } from 'express'
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose'
import './types.js'
import '../env.js'
import { logger } from '../logger.js'
import { prisma } from '../db.js'

const authProvider = process.env.AUTH_PROVIDER ?? 'keycloak'
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
const supabaseIssuer = process.env.SUPABASE_JWT_ISSUER ?? (supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined)
const keycloakIssuer = process.env.OIDC_ISSUER
const compatibility = authProvider === 'dual'
if (!['keycloak', 'supabase', 'dual'].includes(authProvider)) throw new Error('Invalid AUTH_PROVIDER')
if ((!supabaseIssuer && authProvider !== 'keycloak') || (!keycloakIssuer && authProvider !== 'supabase') ||
    (compatibility && keycloakIssuer === supabaseIssuer)) {
  throw new Error('Configure distinct issuers for the enabled identity providers')
}

const providers = new Map<string, { supabase: boolean; audience: string; keys: JWTVerifyGetKey }>()
function register(issuer: string, supabase: boolean, audience: string, jwksUrl: string) {
  providers.set(issuer, { supabase, audience, keys: createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 5000, cooldownDuration: 30000 }) })
}
if (authProvider !== 'supabase' && keycloakIssuer) {
  register(keycloakIssuer, false, process.env.OIDC_AUDIENCE ?? 'mefit-api', `${keycloakIssuer.replace(/\/$/, '')}/protocol/openid-connect/certs`)
}
if (authProvider !== 'keycloak' && supabaseIssuer) {
  register(supabaseIssuer, true, process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated', process.env.SUPABASE_JWKS_URL ?? `${supabaseIssuer.replace(/\/$/, '')}/.well-known/jwks.json`)
}

export function createAuthMiddleware(jwks?: JWTVerifyGetKey): RequestHandler {
  return async (request, response, next) => {
    const header = request.header('authorization')
    const match = header?.match(/^Bearer\s+([^\s]+)$/i)
    if (!match) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } })
      return
    }

    let issuer: string
    let supabase: boolean
    try {
      const token = match[1]!
      const hintedIssuer = decodeJwt(token).iss
      const provider = hintedIssuer && providers.get(hintedIssuer)
      if (!hintedIssuer || !provider) throw new Error('Unknown issuer')
      issuer = hintedIssuer
      supabase = provider.supabase
      const { payload } = await jwtVerify(token, jwks ?? provider.keys, {
        issuer,
        audience: provider.audience,
        algorithms: ['RS256', 'ES256'],
        clockTolerance: supabase ? 60 : 5,
        requiredClaims: ['exp'],
      })
      if (supabase && payload.aal !== 'aal2') {
        response.status(403).json({ error: { code: 'MFA_REQUIRED', message: 'Complete two-step verification before accessing MeFit.' } })
        return
      }
      if (!payload.sub || (!supabase && payload.sub.startsWith('supabase:'))) throw new Error('Invalid subject')
      const tokenEmail = typeof payload.email === 'string' ? payload.email : payload.preferred_username
      if (typeof payload.sub !== 'string' || typeof tokenEmail !== 'string' || !tokenEmail.includes('@')) {
        logger.warn({ hasSubject: typeof payload.sub === 'string', claimNames: Object.keys(payload).sort() }, 'Verified token is missing required identity claims')
        response.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Your sign-in could not be verified. Please sign in again.' } })
        return
      }

      const roleClaims = supabase
        ? (payload.app_metadata as { roles?: unknown } | undefined)?.roles
        : (payload.realm_access as { roles?: unknown } | undefined)?.roles
      const knownRoles = Array.isArray(roleClaims)
        ? roleClaims.filter((role): role is 'USER' | 'CONTRIBUTOR' | 'ADMIN' => role === 'USER' || role === 'CONTRIBUTOR' || role === 'ADMIN')
        : []
      const firstName = typeof payload.given_name === 'string' ? payload.given_name.trim() : ''
      const lastName = typeof payload.family_name === 'string' ? payload.family_name.trim() : ''
      const userMetadata = supabase ? payload.user_metadata as Record<string, unknown> | undefined : undefined
      const claimedName = typeof payload.name === 'string'
        ? payload.name.trim()
        : (typeof userMetadata?.display_name === 'string' ? userMetadata.display_name.trim() : '')
      request.auth = {
        subject: payload.sub,
        email: tokenEmail,
        displayName: [firstName, lastName].filter(Boolean).join(' ') || claimedName,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        roles: [...new Set(knownRoles)],
        emailVerified: payload.email_verified === true,
      }
    } catch {
      logger.warn({ method: request.method, path: request.path }, 'Bearer token validation failed')
      response.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Your sign-in could not be verified. Please sign in again.' } })
      return
    }

    if (supabase) {
      const auth = request.auth!
      const identity = { issuer, subject: auth.subject }
      try {
        const link = await prisma.supabaseIdentity.findUnique({
          where: { issuer_subject: identity },
          select: { user: { select: { oidcSubject: true, disabledAt: true, roles: { select: { role: true } } } } },
        })
        if (link?.user.disabledAt) {
          response.status(403).json({ error: { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled.' } })
          return
        }
        auth.supabaseIdentity = { ...identity, linked: Boolean(link) }
        if (!link && compatibility) auth.subject = `supabase:${issuer}:${identity.subject}`
        if (link) {
          auth.subject = link.user.oidcSubject
          auth.roles = link.user.roles.map(({ role }) => role)
        }
      } catch (error) {
        next(error)
        return
      }
    }
    next()
  }
}

export const requireAuth = createAuthMiddleware()

export function hasRole(roles: readonly string[], requested: string): boolean {
  return roles.includes(requested) || (requested === 'CONTRIBUTOR' && roles.includes('ADMIN')) || (requested === 'USER' && (roles.includes('ADMIN') || roles.includes('CONTRIBUTOR')))
}

export function requireRole(role: 'CONTRIBUTOR' | 'ADMIN'): RequestHandler {
  return async (request, response, next) => {
    if (!request.auth) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } })
      return
    }
    let effectiveRoles = request.auth.roles
    try {
      const account = await prisma.user.findUnique({ where: { oidcSubject: request.auth.subject }, select: { roles: { select: { role: true } } } })
      if (account) effectiveRoles = account.roles.map(({ role: savedRole }) => savedRole)
    } catch (error) {
      logger.error({ err: error }, 'Could not load local role assignments')
      next(error)
      return
    }
    // Use the database role assignment for the rest of this request too.
    // Supabase access tokens may not contain MeFit's app-specific roles.
    request.auth.roles = [...effectiveRoles]
    if (!hasRole(effectiveRoles, role)) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' } })
      return
    }
    next()
  }
}
