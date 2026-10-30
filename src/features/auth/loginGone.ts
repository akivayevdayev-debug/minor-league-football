import type { AuthError } from '@supabase/supabase-js'

/**
 * True when the server says this login or session is gone (the owner deleted the user).
 * Network trouble has no HTTP status, so being offline never signs anyone out.
 */
export function loginIsGone(error: Pick<AuthError, 'status' | 'code'> | null): boolean {
  if (!error?.status) return false
  return error.code === 'user_not_found' || error.code === 'session_not_found' || error.status === 401 || error.status === 403
}
