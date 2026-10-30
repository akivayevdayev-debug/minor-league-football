/* Small pure helpers for showing league data. */
import type { Player, RosterMembership, Team } from '../../types/db'

/** What the app shows: nickname if set, else full name. */
export function displayName(p: Pick<Player, 'nickname' | 'full_name'>): string {
  return p.nickname?.trim() || p.full_name
}

/** 65.5 → 5′5.5″ */
export function formatHeight(inches: number | null): string | null {
  if (inches === null) return null
  const feet = Math.floor(inches / 12)
  const rest = Math.round((inches - feet * 12) * 10) / 10
  return `${feet}′${rest}″`
}

/** Age from birth year only (we never store full birth dates), so it can be a year off. */
export function approxAge(birthYear: number | null, now = new Date()): number | null {
  return birthYear === null ? null : now.getFullYear() - birthYear
}

/** player id → their current team, from open roster lines. */
export function currentTeams(rosters: RosterMembership[], teams: Team[]): Map<string, Team> {
  const byId = new Map(teams.map((t) => [t.id, t]))
  const out = new Map<string, Team>()
  for (const r of rosters) {
    const team = byId.get(r.team_id)
    if (r.ends_on === null && team) out.set(r.player_id, team)
  }
  return out
}

/** Short labels for stat tiles, in display order (matches stat_types.display_order). */
export const STAT_LABELS = [
  ['rec', 'Rec', 'Receptions'],
  ['target', 'Tgt', 'Targets'],
  ['drop', 'Drops', 'Drops'],
  ['td', 'TD', 'Touchdowns'],
  ['fumble', 'Fum', 'Fumbles'],
  ['int', 'INT', 'Interceptions'],
  ['pick6', 'Pick 6', 'Pick 6'],
  ['conv1', '1-pt', '1-point conversions'],
  ['conv2', '2-pt', '2-point conversions'],
  ['block', 'Blk', 'Blocks'],
  ['conv_old', 'Conv', 'Conversions (old sheet)'],
] as const

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

/** "5-3" or "5-3-1" when there are ties. */
export function recordText(r: { wins: number; losses: number; ties: number }): string {
  return r.ties ? `${r.wins}-${r.losses}-${r.ties}` : `${r.wins}-${r.losses}`
}
