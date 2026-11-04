/*
 * Pure parts of the owner-tools server function, kept apart so they can be tested without Deno.
 * Temporary passwords: 12 letters and digits in 3 groups ("abcd-efgh-jkmn"), with look-alike
 * characters (0/o, 1/l/i) left out so they are easy to read out and type on a phone.
 */

export const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Picks each character evenly from TEMP_ALPHABET (no bias), using the random bytes given. */
export function makeTempPassword(randomBytes: (n: number) => Uint8Array): string {
  const max = 256 - (256 % TEMP_ALPHABET.length) // bytes at or above this would favour some characters
  const out: string[] = []
  while (out.length < 12) {
    for (const b of randomBytes(16)) {
      if (b < max && out.length < 12) out.push(TEMP_ALPHABET[b % TEMP_ALPHABET.length]!)
    }
  }
  return `${out.slice(0, 4).join('')}-${out.slice(4, 8).join('')}-${out.slice(8).join('')}`
}

export type OwnerAction =
  | { action: 'list_logins' }
  | { action: 'set_password'; playerId: string; password?: string }
  | { action: 'reset_everyone'; confirm: 'RESET' }
  | { action: 'sign_out_everyone'; confirm: 'SIGN OUT' }
  | { action: 'create_logins'; playerIds: string[]; password?: string }

/** Same floor as the app (MIN_PASSWORD_LENGTH); 72 is the most the sign-in system reads. */
export const CHOSEN_MIN = 8
export const CHOSEN_MAX = 72

/** A password Akiva typed: undefined when none was sent, null when one was sent but is not allowed. */
function chosenPassword(v: unknown): string | undefined | null {
  if (v === undefined) return undefined
  if (typeof v !== 'string') return null
  return v.length >= CHOSEN_MIN && v.length <= CHOSEN_MAX && v.trim() === v ? v : null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Reads the request body. Anything unexpected is refused, and the risky actions need their confirm word. */
export function parseAction(body: unknown): OwnerAction | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  switch (b.action) {
    case 'list_logins':
      return { action: 'list_logins' }
    case 'set_password': {
      if (typeof b.playerId !== 'string' || !UUID.test(b.playerId)) return null
      const password = chosenPassword(b.password)
      if (password === null) return null
      return password === undefined ? { action: 'set_password', playerId: b.playerId } : { action: 'set_password', playerId: b.playerId, password }
    }
    case 'reset_everyone':
      return b.confirm === 'RESET' ? { action: 'reset_everyone', confirm: 'RESET' } : null
    case 'sign_out_everyone':
      return b.confirm === 'SIGN OUT' ? { action: 'sign_out_everyone', confirm: 'SIGN OUT' } : null
    case 'create_logins': {
      if (!Array.isArray(b.playerIds)) return null
      const ids = [...new Set(b.playerIds)]
      if (ids.length < 1 || b.playerIds.length > 50) return null
      if (!ids.every((id) => typeof id === 'string' && UUID.test(id))) return null
      const password = chosenPassword(b.password)
      // A typed password is for one account at a time; several accounts always get their own temporary ones.
      if (password === null || (password !== undefined && ids.length !== 1)) return null
      return password === undefined ? { action: 'create_logins', playerIds: ids as string[] } : { action: 'create_logins', playerIds: ids as string[], password }
    }
    default:
      return null
  }
}

/** Logins that keep their password when Akiva resets everyone. Empty: everyone but the owner is reset
 *  (Akiva, 2026-11-03: Leo is reset too). Add a login name here to spare it. */
export const KEEP_PASSWORD_LOGINS: string[] = []

/** Whether "Reset everyone" gives this login a new password: never the owner, never a kept login. */
export function isResetTarget(l: { is_owner: boolean; login_name: string }): boolean {
  return !l.is_owner && !KEEP_PASSWORD_LOGINS.includes(l.login_name.trim().toLowerCase())
}

/** The sign-in address behind a login name: "Aaron" → "aaron@mlf.invalid" (same as the app and database). */
export function loginEmail(loginName: string): string {
  return `${loginName.trim().toLowerCase()}@mlf.invalid`
}

export interface MissingLogin {
  player_id: string
  full_name: string
  login_name: string
}

/** Players who have a login name but no account yet, by name (on a team or not: league QBs and backups too). */
export function missingLogins(
  players: { id: string; full_name: string; login_name: string | null; is_guest: boolean }[],
  withAccount: Set<string>,
): MissingLogin[] {
  return players
    .filter((p) => !p.is_guest && (p.login_name ?? '').trim() !== '' && !withAccount.has(p.id))
    .map((p) => ({ player_id: p.id, full_name: p.full_name, login_name: (p.login_name ?? '').trim().toLowerCase() }))
    .sort((x, y) => x.full_name.localeCompare(y.full_name))
}
