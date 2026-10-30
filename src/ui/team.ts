import type { TeamColor } from '../types/db'

export const teamBg: Record<TeamColor, string> = {
  demons: 'bg-team-demons',
  daybies: 'bg-team-daybies',
  tigers: 'bg-team-tigers',
}

/** The CSS variable for a team's colour, for glows and rings. */
export const teamVar = (c: TeamColor) => `var(--team-${c})`
