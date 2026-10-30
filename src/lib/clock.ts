/**
 * Game clock countdown from saved state (database plan, idea 4: the clock doesn't tick in the database).
 * `now` must be server-corrected time (phone time + measured offset), so a phone with a wrong clock still agrees.
 */
export interface ClockState {
  running: boolean
  /** Seconds left at the moment the clock was last started or stopped. */
  secondsLeft: number
  /** Server time (ms since epoch) the clock was started; null while stopped. */
  startedAt: number | null
}

export function remainingMs(state: ClockState, now: number): number {
  const saved = state.secondsLeft * 1000
  if (!state.running || state.startedAt === null) return saved
  const elapsed = Math.max(0, now - state.startedAt)
  return Math.max(0, saved - elapsed)
}
