import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { loginEmail, supabase } from '../../lib/supabase'
import { loginIsGone } from './loginGone'
import { changeToNewPassword } from './changePassword'
import { AuthContext, type Auth, type AuthState, type Member, type PasswordResult, type SignInResult } from './auth-context'

type MemberRead = { kind: 'ok'; member: Member | null } | { kind: 'error' }

/** Looks up the login's player link; asks the database to link it once if missing. A failed read is 'error', not 'no player'. */
async function findMember(session: Session): Promise<MemberRead> {
  const read = () =>
    supabase
      .from('member_logins')
      .select('player_id, is_league_manager, is_owner, must_change_password')
      .eq('user_id', session.user.id)
      .maybeSingle()
  let { data, error } = await read()
  if (error) return { kind: 'error' }
  if (!data) {
    await supabase.rpc('link_my_login')
    ;({ data, error } = await read())
    if (error) return { kind: 'error' }
  }
  if (!data) return { kind: 'ok', member: null }
  return {
    kind: 'ok',
    member: {
      playerId: data.player_id as string,
      isLeagueManager: data.is_league_manager as boolean,
      isOwner: data.is_owner as boolean,
      mustChangePassword: data.must_change_password as boolean,
    },
  }
}

/** How often a signed-in device asks the server "does my login still exist?". Also checked on focus and reconnect. */
const LOGIN_CHECK_MS = 2 * 60 * 1000
/** If the profile read fails (flaky signal), try again after this long. */
const PROFILE_RETRY_MS = 5 * 1000

/** Session that survives a reload (Supabase keeps it in local storage and refreshes it). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  // In memory only: the length of the password typed at a successful sign-in. Never stored or logged.
  const [typedPasswordLength, setTypedPasswordLength] = useState<number | null>(null)
  // Each profile read gets a number; only the newest read may update state, so an old read cannot overwrite a newer one.
  const latestRead = useRef(0)
  // True once the new password is stored but the flag is not yet cleared. Lost on reload (rare; the copy covers it).
  const passwordSaved = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function apply(session: Session | null) {
      const run = ++latestRead.current
      if (!session) {
        if (!cancelled && run === latestRead.current) setState({ status: 'signed-out' })
        return
      }
      const result = await findMember(session)
      if (cancelled || run !== latestRead.current) return
      if (result.kind === 'error') {
        // Keep the current screen; try again later instead of calling a signed-in member "not linked".
        setTimeout(() => {
          if (!cancelled) void apply(session)
        }, PROFILE_RETRY_MS)
        return
      }
      const member = result.member
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
    setTypedPasswordLength(null)
    if (!navigator.onLine) return 'offline'
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail(loginName), password })
    if (!error) {
      setTypedPasswordLength(password.length)
      return 'ok'
    }
    if (import.meta.env.DEV) console.warn('sign-in failed:', error.status, error.code)
    // Network failures have no HTTP status; everything else is one message so names can't be probed.
    return error.status ? 'wrong-details' : 'offline'
  }, [])

  const signOut = useCallback(async () => {
    setTypedPasswordLength(null)
    passwordSaved.current = false
    await supabase.auth.signOut()
  }, [])

  const changePassword = useCallback(async (newPassword: string): Promise<PasswordResult> => {
    const result = await changeToNewPassword(
      {
        updatePassword: (password) => supabase.auth.updateUser({ password }),
        clearFlag: async () => !(await supabase.rpc('clear_my_password_flag')).error,
        wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      },
      newPassword,
      passwordSaved,
    )
    if (result !== 'ok') return result
    // Stop any profile read that started before the flag was cleared, then update the member in place.
    ++latestRead.current
    setState((prev) => (prev.status === 'member' ? { ...prev, member: { ...prev.member, mustChangePassword: false } } : prev))
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
