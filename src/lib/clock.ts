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

export type ClockPhase = 'running' | 'paused' | 'expired'

/** Expired at 0:00 whether or not the clock still says it is running. */
export function clockPhase(remaining: number, running: boolean): ClockPhase {
  if (remaining <= 0) return 'expired'
  return running ? 'running' : 'paused'
}

/** Whole seconds left at `now` (rounded up, like the display). Read `now` at the moment of a tap, never from the last redraw. */
export function secondsLeftAt(state: ClockState, now: number): number {
  return Math.ceil(remainingMs(state, now) / 1000)
}
