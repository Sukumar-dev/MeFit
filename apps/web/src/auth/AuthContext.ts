import { createContext, useContext } from 'react'
import type { AppSession } from './session'

export interface AuthContextValue {
  session: AppSession | null
  setSession: (session: AppSession) => void
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
