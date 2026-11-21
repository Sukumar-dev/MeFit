import type { RequestHandler } from 'express'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import './types.js'
import '../env.js'
import { logger } from '../logger.js'
import { prisma } from '../db.js'

const authProvider = process.env.AUTH_PROVIDER ?? 'keycloak'
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
const configuredIssuer = authProvider === 'supabase'
  ? (process.env.SUPABASE_JWT_ISSUER ?? (supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined))
  : process.env.OIDC_ISSUER
const audience = authProvider === 'supabase' ? (process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated') : (process.env.OIDC_AUDIENCE ?? 'mefit-api')
if (!configuredIssuer) throw new Error(authProvider === 'supabase' ? 'SUPABASE_URL or SUPABASE_JWT_ISSUER must be configured' : 'OIDC_ISSUER must be configured')
const issuer: string = configuredIssuer
const jwksUrl = authProvider === 'supabase'
  ? (process.env.SUPABASE_JWKS_URL ?? `${issuer.replace(/\/$/, '')}/.well-known/jwks.json`)
  : `${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`

const remoteJwks = createRemoteJWKSet(new URL(jwksUrl), {
  timeoutDuration: 5000,
  cooldownDuration: 30000,
})

export function createAuthMiddleware(jwks: JWTVerifyGetKey = remoteJwks): RequestHandler {
  return async (request, response, next) => {
    const header = request.header('authorization')
    const match = header?.match(/^Bearer\s+([^\s]+)$/i)
    if (!match) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } })
      return
    }

    try {
      const { payload } = await jwtVerify(match[1]!, jwks, {
        issuer,
        audience,
        algorithms: ['RS256', 'ES256'],
        clockTolerance: 5,
      })
      if (authProvider === 'supabase' && payload.aal !== 'aal2') {
        response.status(403).json({ error: { code: 'MFA_REQUIRED', message: 'Complete two-step verification before accessing MeFit.' } })
        return
      }
      const tokenEmail = typeof payload.email === 'string' ? payload.email : payload.preferred_username
      if (typeof payload.sub !== 'string' || typeof tokenEmail !== 'string' || !tokenEmail.includes('@')) {
        logger.warn({ hasSubject: typeof payload.sub === 'string', claimNames: Object.keys(payload).sort() }, 'Verified token is missing required identity claims')
        response.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'The supplied access token is invalid.' } })
        return
      }

      const roleClaims = authProvider === 'supabase'
        ? (payload.app_metadata as { roles?: unknown } | undefined)?.roles
        : (payload.realm_access as { roles?: unknown } | undefined)?.roles
      const knownRoles = Array.isArray(roleClaims)
        ? roleClaims.filter((role): role is 'USER' | 'CONTRIBUTOR' | 'ADMIN' => role === 'USER' || role === 'CONTRIBUTOR' || role === 'ADMIN')
        : []
      const firstName = typeof payload.given_name === 'string' ? payload.given_name.trim() : ''
      const lastName = typeof payload.family_name === 'string' ? payload.family_name.trim() : ''
      const userMetadata = authProvider === 'supabase' ? payload.user_metadata as Record<string, unknown> | undefined : undefined
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
      next()
    } catch (error) {
      logger.warn({ err: error, method: request.method, path: request.path }, 'Bearer token validation failed')
      response.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'The supplied access token is invalid or expired.' } })
    }
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
