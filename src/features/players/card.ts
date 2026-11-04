/*
 * The player card: totals, the last games and who each game was against, from the player's
 * game log (one row per final game they played). Pure functions, tested without a database.
 */

export interface LogGame {
  game_id: string
  season_id: string
  week: number | null
  starts_at: string | null
  points: number
  stats: Record<string, number>
  home_team_id: string | null
  away_team_id: string | null
}

export interface CardTotals {
  games: number
  points: number
  /** Points per game, or null with no games. */
  perGame: number | null
  stats: Record<string, number>
}

/** Totals for one season (or the whole career when seasonId is null). */
export function cardTotals(log: LogGame[], seasonId: string | null): CardTotals {
  const rows = seasonId ? log.filter((g) => g.season_id === seasonId) : log
  const stats: Record<string, number> = {}
  for (const g of rows) for (const [k, v] of Object.entries(g.stats)) stats[k] = (stats[k] ?? 0) + Number(v)
  const points = rows.reduce((n, g) => n + g.points, 0)
  return { games: rows.length, points, perGame: rows.length ? points / rows.length : null, stats }
}

/** The newest games first, at most n (one season, or all seasons when seasonId is null). */
export function recentGames(log: LogGame[], seasonId: string | null, n = 9): LogGame[] {
  const key = (g: LogGame) => `${g.starts_at ?? ''}|${String(g.week ?? 0).padStart(3, '0')}`
  return (seasonId ? log.filter((g) => g.season_id === seasonId) : log)
    .slice()
    .sort((a, b) => key(b).localeCompare(key(a)))
    .slice(0, n)
}

interface Membership {
  team_id: string
  starts_on: string
  ends_on: string | null
}

/**
 * The team the player faced: the side of the game that wasn't theirs. Their side is the team they
 * were on that day; failing that, the only one of the two teams they ever played for.
 */
export function opponentIn(game: Pick<LogGame, 'home_team_id' | 'away_team_id' | 'starts_at'>, history: Membership[]): string | null {
  const { home_team_id: home, away_team_id: away } = game
  if (!home || !away) return null
  const day = game.starts_at?.slice(0, 10)
  const onDay = day ? history.find((r) => r.starts_on <= day && (r.ends_on === null || r.ends_on > day) && (r.team_id === home || r.team_id === away)) : undefined
  const mine = onDay?.team_id ?? [home, away].filter((t) => history.some((r) => r.team_id === t)).at(0) ?? null
  if (mine === home) return away
  if (mine === away) return home
  return null
}

/** Stats worth a mention in a one-line game summary, most telling first, with short labels. */
const GAME_LINE: [string, string][] = [
  ['pass_td', 'Pass TD'],
  ['td', 'TD'],
  ['qb_rush_td', 'Rush TD'],
  ['rec', 'Rec'],
  ['int', 'INT'],
  ['pick6', 'Pick 6'],
  ['sack', 'Sack'],
  ['block', 'Blk'],
  ['int_thrown', 'INT thrown'],
  ['drop', 'Drop'],
  ['fumble', 'Fum'],
]

/** "2 TD · 5 Rec · 1 INT": up to three stats from a game, or "" when there are none. */
export function gameLine(stats: Record<string, number>, max = 3): string {
  return GAME_LINE.filter(([k]) => (stats[k] ?? 0) !== 0)
    .slice(0, max)
    .map(([k, label]) => `${stats[k]} ${label}`)
    .join(' · ')
}

interface QbGame {
  id: string
  status: string
  week: number | null
  starts_at: string | null
  voided_at: string | null
  home_qb_id: string | null
  away_qb_id: string | null
}

/** The game being played now, or else the next one, where this player is set as a QB. */
export function nextAsQb<G extends QbGame>(games: G[], playerId: string): G | null {
  const mine = games.filter((g) => !g.voided_at && (g.home_qb_id === playerId || g.away_qb_id === playerId))
  const live = mine.find((g) => g.status === 'live' || g.status === 'halftime')
  if (live) return live
  const when = (g: G) => `${String(g.week ?? 0).padStart(3, '0')}|${g.starts_at ?? ''}`
  return mine.filter((g) => g.status === 'scheduled').sort((a, b) => when(a).localeCompare(when(b)))[0] ?? null
}
