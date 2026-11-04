/*
 * The MVP race, worked out from points per game (database view player_game_points) and Eddie's pins.
 * Pure functions, so the rules are tested without a database.
 *   • Ranked by points per game. Ties: more total points, then more games.
 *   • To be ranked, a player must have played at least half of their team's final games.
 *     A QB (no team) is measured against the Sundays that had a final game.
 *   • A pinned player sits at the pinned place; everyone else fills the other places in order.
 */

export interface GamePoints {
  player_id: string
  game_id: string
  week: number | null
  points: number
  stats: Record<string, number>
}

export interface FinalGame {
  id: string
  week: number | null
  home_team_id: string | null
  away_team_id: string | null
}

export interface Pin {
  player_id: string
  place: number
  pinned_by: string | null
}

export interface RaceRow {
  playerId: string
  place: number
  points: number
  games: number
  perGame: number
  /** Places moved up since last week (negative = down). Null when there is no last week to compare. */
  moved: number | null
  /** The player who pinned this place, when it is pinned. */
  pinnedBy: string | null
}

export interface WaitingRow {
  playerId: string
  points: number
  games: number
  needed: number
}

export interface Race {
  ranked: RaceRow[]
  /** Played, but not enough games yet. */
  waiting: WaitingRow[]
  /** The latest week counted, or null before any final game. */
  week: number | null
}

interface RaceInput {
  points: GamePoints[]
  finalGames: FinalGame[]
  /** Each player's current team; QBs have none. */
  teamOf: Map<string, string>
  pins: Pin[]
}

const weekOf = (w: number | null) => w ?? 0

/** Games needed to be ranked: half of the team's final games (or Sundays, for a QB), rounded up, at least 1. */
export function gamesNeeded(teamId: string | undefined, finalGames: FinalGame[]): number {
  const count = teamId
    ? finalGames.filter((g) => g.home_team_id === teamId || g.away_team_id === teamId).length
    : new Set(finalGames.map((g) => weekOf(g.week))).size
  return Math.max(1, Math.ceil(count / 2))
}

function standings(input: RaceInput, throughWeek: number | null) {
  const within = <T extends { week: number | null }>(rows: T[]) =>
    throughWeek === null ? rows : rows.filter((r) => weekOf(r.week) <= throughWeek)
  const games = within(input.finalGames)
  const totals = new Map<string, { points: number; games: number }>()
  for (const row of within(input.points)) {
    const t = totals.get(row.player_id) ?? { points: 0, games: 0 }
    t.points += Number(row.points)
    t.games += 1
    totals.set(row.player_id, t)
  }

  const qualified: Omit<RaceRow, 'place' | 'moved' | 'pinnedBy'>[] = []
  const waiting: WaitingRow[] = []
  for (const [playerId, t] of totals) {
    const needed = gamesNeeded(input.teamOf.get(playerId), games)
    const row = { playerId, points: t.points, games: t.games }
    if (t.games >= needed) qualified.push({ ...row, perGame: t.points / t.games })
    else waiting.push({ ...row, needed })
  }
  qualified.sort((a, b) => b.perGame - a.perGame || b.points - a.points || b.games - a.games || a.playerId.localeCompare(b.playerId))
  waiting.sort((a, b) => b.points - a.points || a.playerId.localeCompare(b.playerId))

  // Pins first, at their places; the formula fills the rest. A pinned player is always ranked.
  const pinned = new Map(input.pins.map((p) => [p.player_id, p]))
  const pinnedRows = input.pins
    .map((p) => {
      const t = totals.get(p.player_id) ?? { points: 0, games: 0 }
      return { pin: p, row: { playerId: p.player_id, points: t.points, games: t.games, perGame: t.games ? t.points / t.games : 0 } }
    })
    .sort((a, b) => a.pin.place - b.pin.place)
  const rest = qualified.filter((r) => !pinned.has(r.playerId))
  const total = rest.length + pinnedRows.length
  const ranked: RaceRow[] = []
  let next = 0
  let pinIndex = 0
  for (let place = 1; place <= total; place++) {
    const p = pinnedRows[pinIndex]
    // A pin past the end of the list sits at the bottom, still in pin order.
    if (p && (p.pin.place === place || next >= rest.length)) {
      ranked.push({ ...p.row, place, moved: null, pinnedBy: p.pin.pinned_by })
      pinIndex++
    } else {
      ranked.push({ ...rest[next]!, place, moved: null, pinnedBy: null })
      next++
    }
  }

  return { ranked, waiting: waiting.filter((w) => !pinned.has(w.playerId)), weeks: games.map((g) => weekOf(g.week)) }
}

/** The race as it stands, with how far each player moved since the week before. */
export function mvpRace(input: RaceInput): Race {
  const now = standings(input, null)
  if (now.weeks.length === 0) return { ranked: now.ranked, waiting: now.waiting, week: null }
  const week = Math.max(...now.weeks)
  const earlier = now.weeks.filter((w) => w < week)
  if (earlier.length > 0) {
    const before = new Map(standings(input, Math.max(...earlier)).ranked.map((r) => [r.playerId, r.place]))
    for (const row of now.ranked) {
      const was = before.get(row.playerId)
      row.moved = was === undefined ? null : was - row.place
    }
  }
  return { ranked: now.ranked, waiting: now.waiting, week }
}

export interface WeekStar {
  playerId: string
  week: number
  points: number
  reason: string
}

/** The top scorer of each week, newest first. Ties: the player with more touchdowns, then by id. */
export function playersOfTheWeek(points: GamePoints[], labels: Map<string, string>): WeekStar[] {
  const byWeek = new Map<number, Map<string, { points: number; stats: Record<string, number> }>>()
  for (const row of points) {
    const w = weekOf(row.week)
    const week = byWeek.get(w) ?? new Map()
    const t = week.get(row.player_id) ?? { points: 0, stats: {} }
    t.points += Number(row.points)
    for (const [k, v] of Object.entries(row.stats)) t.stats[k] = (t.stats[k] ?? 0) + Number(v)
    week.set(row.player_id, t)
    byWeek.set(w, week)
  }
  const stars: WeekStar[] = []
  for (const [week, players] of byWeek) {
    const best = [...players].sort(
      ([ida, a], [idb, b]) => b.points - a.points || (b.stats.td ?? 0) - (a.stats.td ?? 0) || ida.localeCompare(idb),
    )[0]
    if (!best || best[1].points <= 0) continue
    stars.push({ playerId: best[0], week, points: best[1].points, reason: describeStats(best[1].stats, labels) })
  }
  return stars.sort((a, b) => b.week - a.week)
}

// Short names for the stats people talk about. Others use their label from the stat list.
const SHORT: Record<string, [string, string]> = {
  td: ['TD', 'TDs'],
  rec: ['catch', 'catches'],
  int: ['pick', 'picks'],
  pick6: ['pick six', 'pick sixes'],
  block: ['block', 'blocks'],
  pass_td: ['passing TD', 'passing TDs'],
  rec_td: ['receiving TD', 'receiving TDs'],
  return_td: ['return TD', 'return TDs'],
  sack: ['sack', 'sacks'],
  conv1: ['1-point try', '1-point tries'],
  conv2: ['2-point try', '2-point tries'],
  conv_old: ['extra point', 'extra points'],
}
// Stats that don't make someone player of the week, so they never lead the line.
const NOT_A_REASON = new Set(['drop', 'fumble', 'fumble_lost', 'int_thrown', 'sack_taken', 'sack_allowed', 'pressure_allowed', 'blocking_penalty', 'penalty', 'incompletion', 'target', 'turnover'])
const ORDER = ['td', 'pass_td', 'rec_td', 'return_td', 'pick6', 'int', 'rec', 'sack', 'block']

/** "2 TDs, 3 catches, 1 pick": the player's best stats in order, at most three. */
export function describeStats(stats: Record<string, number>, labels: Map<string, string>): string {
  const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length)
  const parts = Object.entries(stats)
    .filter(([id, v]) => v > 0 && !NOT_A_REASON.has(id))
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .slice(0, 3)
    .map(([id, v]) => {
      const [one, many] = SHORT[id] ?? [(labels.get(id) ?? id).toLowerCase(), (labels.get(id) ?? id).toLowerCase()]
      return `${v} ${v === 1 ? one : many}`
    })
  return parts.join(', ')
}
