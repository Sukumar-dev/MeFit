export interface AppSession {
  accessToken: string
  idToken: string
  expiresAt: number
  user: {
    id: string
    email: string
    displayName: string
    firstName?: string
    lastName?: string
    roles: string[]
    hasProfile: boolean
  }
}

export function fullNameForUser(user: AppSession['user']): string {
  const first = user.firstName?.trim() ?? ''
  const last = user.lastName?.trim() ?? ''
  const name = [first, last].filter(Boolean).join(' ') || user.displayName.trim()
  return name && name.toLocaleLowerCase() !== user.email.trim().toLocaleLowerCase() ? name : ''
}

const SESSION_KEY = 'mefit.session'

export function readSession(): AppSession | null {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY)
    if (!stored) return null
    const session = JSON.parse(stored) as AppSession
    if (!session.accessToken || !session.idToken || session.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function storeSession(session: AppSession): void {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY)
}
