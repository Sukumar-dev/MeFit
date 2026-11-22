export type MeFitRole = 'USER' | 'CONTRIBUTOR' | 'ADMIN'

export interface AuthClaims {
  subject: string
  email: string
  displayName: string
  firstName?: string
  lastName?: string
  roles: MeFitRole[]
  emailVerified: boolean
  supabaseIdentity?: { issuer: string; subject: string; linked: boolean }
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims
    }
  }
}
