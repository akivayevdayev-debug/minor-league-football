/** Shortest password the app accepts (the server's own minimum is also 8). */
export const MIN_PASSWORD_LENGTH = 8

/**
 * True when the member has to choose a new password before using the app:
 * the database flag is set, or the password they just typed is too short to be allowed.
 * `typedLength` is null when the session was restored (no password typed on this visit).
 */
export function needsNewPassword(typedLength: number | null, flag: boolean): boolean {
  return flag || (typedLength !== null && typedLength < MIN_PASSWORD_LENGTH)
}
