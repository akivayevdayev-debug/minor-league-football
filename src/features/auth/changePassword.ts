import type { PasswordResult } from './auth-context'

/** Flag-clear attempts before we give up for now (one try plus two quiet retries). */
const CLEAR_ATTEMPTS = 3
const RETRY_GAP_MS = 400

/** The two server calls, passed in so the sequence can be tested without Supabase. */
export interface PasswordDeps {
  updatePassword(password: string): Promise<{ error: { code?: string } | null }>
  /** True when the database cleared the flag for the signed-in login. */
  clearFlag(): Promise<boolean>
  wait(ms: number): Promise<void>
}

/**
 * Saves the new password, then clears the forced-change flag.
 * `saved` is true once the password is stored but the flag is not yet cleared. A retry then only clears the flag,
 * so a retry never sends the same password again (that would answer "same password" and look like a failure).
 */
export async function changeToNewPassword(deps: PasswordDeps, newPassword: string, saved: { current: boolean }): Promise<PasswordResult> {
  if (!saved.current) {
    const { error } = await deps.updatePassword(newPassword)
    if (error) {
      if (error.code === 'weak_password') return 'too-weak'
      if (error.code === 'same_password') return 'same-as-old'
      return 'failed'
    }
    saved.current = true
  }
  for (let attempt = 1; attempt <= CLEAR_ATTEMPTS; attempt++) {
    if (await deps.clearFlag()) {
      saved.current = false
      return 'ok'
    }
    if (attempt < CLEAR_ATTEMPTS) await deps.wait(RETRY_GAP_MS)
  }
  return 'saved-not-finished'
}
