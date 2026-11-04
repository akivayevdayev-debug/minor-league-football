/*
 * The Team tab and matchup page: this week's game, each player's projected and actual points,
 * and players paired across a matchup by position. Pure functions, tested without a database.
 */
import type { Game } from '../../types/db'

/** 12 stays "12", 8.5 shows "8.5". */
export const fmtPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** A team's game for "this week": a game being played now, else the next one, else the latest final. */
export function weekGame(teamId: string, games: Game[]): Game | null {
  const mine = games.filter(
    (g) => !g.voided_at && g.home_team_id && g.away_team_id && (g.home_team_id === teamId || g.away_team_id === teamId),
  )
  const when = (g: Game) => `${String(g.week ?? 0).padStart(3, '0')}|${g.starts_at ?? ''}`
  const live = mine.find((g) => g.status === 'live' || g.status === 'halftime')
  if (live) return live
  const next = mine.filter((g) => g.status === 'scheduled').sort((a, b) => when(a).localeCompare(when(b)))[0]
  if (next) return next
  return mine.filter((g) => g.status === 'final').sort((a, b) => when(b).localeCompare(when(a)))[0] ?? null
}

/** The other team in a game. */
export function opponentOf(game: Game, teamId: string): string | null {
  return game.home_team_id === teamId ? game.away_team_id : game.home_team_id
}

/** The QB playing for a team in a game, as recorded on the game. */
export function qbOf(game: Game, teamId: string): string | null {
  return game.home_team_id === teamId ? game.home_qb_id : game.away_qb_id
}

export interface StatLine {
  player_id: string | null
  stat_type_id: string
  value: number
}

export interface PointsLine {
  statTypeId: string
  value: number
  points: number
}

export interface PlayerPoints {
  points: number
  /** Every stat the player has in the game, scoring ones first. */
  lines: PointsLine[]
}

/** Each player's fantasy points in one game, with how they were scored. */
export function gamePoints(stats: StatLine[], pointsPer: Map<string, number>): Map<string, PlayerPoints> {
  const sums = new Map<string, Map<string, number>>()
  for (const s of stats) {
    if (!s.player_id) continue
    const mine = sums.get(s.player_id) ?? new Map<string, number>()
    mine.set(s.stat_type_id, (mine.get(s.stat_type_id) ?? 0) + Number(s.value))
    sums.set(s.player_id, mine)
  }
  const out = new Map<string, PlayerPoints>()
  for (const [playerId, byStat] of sums) {
    const lines = [...byStat]
      .filter(([, value]) => value !== 0)
      .map(([statTypeId, value]) => ({ statTypeId, value, points: value * (pointsPer.get(statTypeId) ?? 0) }))
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.statTypeId.localeCompare(b.statTypeId))
    out.set(playerId, { points: lines.reduce((n, l) => n + l.points, 0), lines })
  }
  return out
}

export interface WeekRow {
  playerId: string
  isQb: boolean
  position: string
  /** Estimated points for the game, or null when there is no estimate yet. */
  projected: number | null
  /** Points scored in the game so far; null before kickoff. */
  actual: number | null
  breakdown: PointsLine[]
}

export interface TeamWeek {
  /** This week's QB first (when known), then the roster, best estimate first. */
  rows: WeekRow[]
  projected: number
  /** Null before kickoff. */
  actual: number | null
}

interface TeamWeekInput {
  roster: { id: string; position: string }[]
  qbId: string | null
  game: Game | null
  projected: Map<string, number>
  /** Points in this week's game (null before kickoff or with no game). */
  scored: Map<string, PlayerPoints> | null
}

export function teamWeek({ roster, qbId, game, projected, scored }: TeamWeekInput): TeamWeek {
  const started = !!game && game.status !== 'scheduled' && !!scored
  const row = (id: string, position: string, isQb: boolean): WeekRow => ({
    playerId: id,
    isQb,
    position,
    projected: projected.get(id) ?? null,
    actual: started ? (scored!.get(id)?.points ?? 0) : null,
    breakdown: started ? (scored!.get(id)?.lines ?? []) : [],
  })
  const players = roster
    .filter((p) => p.id !== qbId)
    .map((p) => row(p.id, p.position, false))
    .sort((a, b) => (b.projected ?? -1) - (a.projected ?? -1) || a.playerId.localeCompare(b.playerId))
  const rows = qbId ? [row(qbId, 'QB', true), ...players] : players
  return {
    rows,
    projected: rows.reduce((n, r) => n + (r.projected ?? 0), 0),
    actual: started ? rows.reduce((n, r) => n + (r.actual ?? 0), 0) : null,
  }
}

/**
 * Players facing each other on the matchup page: QB against QB, then the same position against
 * the same position (best estimate first), then whoever is left, in estimate order.
 */
export function pairByPosition(home: WeekRow[], away: WeekRow[]): [WeekRow | null, WeekRow | null][] {
  const pairs: [WeekRow | null, WeekRow | null][] = []
  const qbHome = home.find((r) => r.isQb) ?? null
  const qbAway = away.find((r) => r.isQb) ?? null
  if (qbHome || qbAway) pairs.push([qbHome, qbAway])

  const left = home.filter((r) => !r.isQb)
  const right = away.filter((r) => !r.isQb)
  const used = new Set<WeekRow>()
  for (const h of left) {
    const match = right.find((a) => !used.has(a) && a.position === h.position)
    if (!match) continue
    used.add(h)
    used.add(match)
    pairs.push([h, match])
  }
  const restLeft = left.filter((r) => !used.has(r))
  const restRight = right.filter((r) => !used.has(r))
  for (let i = 0; i < Math.max(restLeft.length, restRight.length); i++) {
    pairs.push([restLeft[i] ?? null, restRight[i] ?? null])
  }
  return pairs
}
