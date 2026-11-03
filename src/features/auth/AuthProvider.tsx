import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { loginEmail, supabase } from '../../lib/supabase'
import { loginIsGone } from './loginGone'
import { AuthContext, type Auth, type AuthState, type Member, type PasswordResult, type SignInResult } from './auth-context'

/** Looks up the login's player link; asks the database to link it once if missing. */
async function findMember(session: Session): Promise<Member | null> {
  const read = () =>
    supabase
      .from('member_logins')
      .select('player_id, is_league_manager, is_owner, must_change_password')
      .eq('user_id', session.user.id)
      .maybeSingle()
  let { data } = await read()
  if (!data) {
    await supabase.rpc('link_my_login')
    ;({ data } = await read())
  }
  return data
    ? {
        playerId: data.player_id as string,
        isLeagueManager: data.is_league_manager as boolean,
        isOwner: data.is_owner as boolean,
        mustChangePassword: data.must_change_password as boolean,
      }
    : null
}

/** How often a signed-in device asks the server "does my login still exist?". Also checked on focus and reconnect. */
const LOGIN_CHECK_MS = 2 * 60 * 1000

/** Session that survives a reload (Supabase keeps it in local storage and refreshes it). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  // In memory only: the length of the password typed at sign-in. Never stored or logged.
  const [typedPasswordLength, setTypedPasswordLength] = useState<number | null>(null)
  // Each profile read gets a number; only the newest read may update state, so an old read cannot overwrite a newer one.
  const latestRead = useRef(0)

  useEffect(() => {
    let cancelled = false
    async function apply(session: Session | null) {
      const run = ++latestRead.current
      if (!session) {
        if (!cancelled && run === latestRead.current) setState({ status: 'signed-out' })
        return
      }
      const member = await findMember(session)
      if (cancelled || run !== latestRead.current) return
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

  // A deleted login: sign this device out. Player data stays; only the login is gone.
  const signedIn = state.status === 'member' || state.status === 'unlinked'
  useEffect(() => {
    if (!signedIn) return
    let checking = false
    async function check() {
      if (checking || !navigator.onLine || document.visibilityState === 'hidden') return
      checking = true
      const { error } = await supabase.auth.getUser()
      checking = false
      if (!loginIsGone(error)) return
      await supabase.auth.signOut({ scope: 'local' })
      toast('Signed out: this login no longer exists. Ask the owner if that is a mistake.')
    }
    const onVisible = () => void check()
    const timer = setInterval(() => void check(), LOGIN_CHECK_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    window.addEventListener('online', onVisible)
    void check()
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [signedIn])

  const signIn = useCallback(async (loginName: string, password: string): Promise<SignInResult> => {
    if (!navigator.onLine) return 'offline'
    setTypedPasswordLength(password.length)
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(loginName), password })
    if (!error) return 'ok'
    if (import.meta.env.DEV) console.warn('sign-in failed:', error.status, error.code)
    // Network failures have no HTTP status; everything else is one message so names can't be probed.
    return error.status ? 'wrong-details' : 'offline'
  }, [])

  const signOut = useCallback(async () => {
    setTypedPasswordLength(null)
    await supabase.auth.signOut()
  }, [])

  const changePassword = useCallback(async (newPassword: string): Promise<PasswordResult> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      if (error.code === 'weak_password') return 'too-weak'
      if (error.code === 'same_password') return 'same-as-old'
      return 'failed'
    }
    // The new password is saved; now clear the forced-change flag (the database only lets the login clear its own).
    const { error: flagError } = await supabase.rpc('clear_my_password_flag')
    if (flagError) return 'failed'
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      const run = ++latestRead.current
      const member = await findMember(data.session)
      if (member && run === latestRead.current) setState({ status: 'member', session: data.session, member })
    }
    // A longer new password also lifts the "too short" rule that applied to the sign-in password.
    setTypedPasswordLength(newPassword.length)
    return 'ok'
  }, [])

  const auth = useMemo<Auth>(
    () => ({ state, signIn, signOut, changePassword, typedPasswordLength }),
    [state, signIn, signOut, changePassword, typedPasswordLength],
  )
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
