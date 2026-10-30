import type { CSSProperties } from 'react'
import type { TeamColor } from '../types/db'
import type { IconName } from './Icon'

export const teamBg: Record<TeamColor, string> = {
  demons: 'bg-team-demons',
  daybies: 'bg-team-daybies',
  tigers: 'bg-team-tigers',
}

/** Each team's crest motif (Phosphor, via ui/Icon). */
export const teamMotif: Record<TeamColor, IconName> = {
  demons: 'bolt',
  daybies: 'city', // DUMBO, Brooklyn
  tigers: 'paw',
}

/** The CSS variable for a team's colour, for glows and rings. */
export const teamVar = (c: TeamColor) => `var(--team-${c})`

/**
 * Inline style that sets --team, --team-light and --team-deep for everything inside.
 * No team (a league QB, a guest) gets the neutral greys.
 */
export function teamStyle(c: TeamColor | null | undefined): CSSProperties {
  const k = c ?? 'none'
  return { '--team': `var(--team-${k})`, '--team-light': `var(--team-${k}-light)`, '--team-deep': `var(--team-${k}-deep)` } as CSSProperties
}
