import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface Member {
  playerId: string
  isLeagueManager: boolean
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'unlinked'; session: Session }
  | { status: 'member'; session: Session; member: Member }

export type SignInResult = 'ok' | 'wrong-details' | 'offline'
export type PasswordResult = 'ok' | 'too-weak' | 'same-as-old' | 'failed'

export interface Auth {
  state: AuthState
  signIn(loginName: string, password: string): Promise<SignInResult>
  signOut(): Promise<void>
  changePassword(newPassword: string): Promise<PasswordResult>
}

export const AuthContext = createContext<Auth | null>(null)

export function useAuth(): Auth {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}

/** For screens that only render for members (everything behind AuthGate). */
export function useMember(): Member {
  const { state } = useAuth()
  if (state.status !== 'member') throw new Error('useMember used outside a member screen')
  return state.member
}
