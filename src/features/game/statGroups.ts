/*
 * Which stat groups a player's stat pad shows, the game-time label of a stat line, and the friendly
 * text for a per-game limit the database refused.
 */
import type { StatGroup } from '../../types/db'

/** The stat groups a position brings. Several codes may share one entry ("OL/TE"). */
const GROUPS_BY_POSITION = new Map<string, StatGroup[]>([
  ['WR', ['receiving']],
  ['OL', ['receiving', 'line']],
  ['TE', ['receiving', 'line']],
  ['DL', ['defense']],
])

/**
 * The groups on a player's pad. A QB sees only the QB group; anyone else sees the groups for
 * their positions. Defense and kicks always come last.
 */
export function groupsFor(positions: string[], isQb: boolean): StatGroup[] {
  const fromPositions: StatGroup[] = isQb
    ? ['qb']
    : positions.flatMap((entry) =>
        entry
          .toUpperCase()
          .split(/[\s/,]+/)
          .flatMap((code) => GROUPS_BY_POSITION.get(code) ?? []),
      )
  return [...new Set<StatGroup>([...fromPositions, 'defense', 'kicks'])]
}

const HALF_NAME = new Map<number, string>([
  [1, '1st'],
  [2, '2nd'],
  [3, 'OT'],
])

/** "2nd · 4:12" for a stat tapped with 4:12 left in the 2nd half; null when either part is unknown. */
export function statTimeLabel(half: number | null, clockSeconds: number | null): string | null {
  const name = half === null ? undefined : HALF_NAME.get(half)
  if (!name || clockSeconds === null) return null
  const minutes = Math.floor(clockSeconds / 60)
  const seconds = String(clockSeconds % 60).padStart(2, '0')
  return `${name} · ${minutes}:${seconds}`
}

const LIMIT = /^MLF_LIMIT:(.+):(\d+)$/

/** The friendly line for a "MLF_LIMIT:<label>:<max>" error from the database, else null. */
export function limitMessage(raw: string): string | null {
  const m = LIMIT.exec(raw)
  if (!m) return null
  return `That's more than ${m[2]} ${m[1]} for one game. Check the number.`
}
