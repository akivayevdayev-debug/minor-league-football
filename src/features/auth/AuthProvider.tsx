import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { loginEmail, supabase } from '../../lib/supabase'
import { AuthContext, type Auth, type AuthState, type Member, type PasswordResult, type SignInResult } from './auth-context'

/** Looks up the login's player link; asks the database to link it once if missing. */
async function findMember(session: Session): Promise<Member | null> {
  const read = () =>
    supabase.from('member_logins').select('player_id, is_league_manager').eq('user_id', session.user.id).maybeSingle()
  let { data } = await read()
  if (!data) {
    await supabase.rpc('link_my_login')
    ;({ data } = await read())
  }
  return data ? { playerId: data.player_id as string, isLeagueManager: data.is_league_manager as boolean } : null
}

/** Session that survives a reload (Supabase keeps it in local storage and refreshes it). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function apply(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ status: 'signed-out' })
        return
      }
      const member = await findMember(session)
      if (cancelled) return
      setState(member ? { status: 'member', session, member } : { status: 'unlinked', session })
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Token refreshes keep the same person; only re-check on real changes.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // Deferred: Supabase advises against awaiting its own calls inside this callback.
        setTimeout(() => void apply(session), 0)
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (loginName: string, password: string): Promise<SignInResult> => {
    if (!navigator.onLine) return 'offline'
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(loginName), password })
    if (!error) return 'ok'
    if (import.meta.env.DEV) console.warn('sign-in failed:', error.status, error.code)
    // Network failures have no HTTP status; everything else is one message so names can't be probed.
    return error.status ? 'wrong-details' : 'offline'
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const changePassword = useCallback(async (newPassword: string): Promise<PasswordResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (!error) return 'ok'
    if (error.code === 'weak_password') return 'too-weak'
    if (error.code === 'same_password') return 'same-as-old'
    return 'failed'
  }, [])

  const auth = useMemo<Auth>(() => ({ state, signIn, signOut, changePassword }), [state, signIn, signOut, changePassword])
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
