/*
 * Who is on the field. Two players per team play at once; the third sits and subs in.
 * Each lineup row is a team's on-field players from one clock moment on (kickoff writes the first,
 * every sub writes a new one). Playing time is worked out from these rows, never stored as a total.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { remainingMs } from '../../lib/clock'
import { rows } from '../league/api'
import type { Game, GameClock } from '../../types/db'

export const ON_FIELD = 2

export interface Lineup {
  id: string
  game_id: string
  team_id: string
  on_field: string[]
  half: number
  clock_seconds: number
  created_at: string
}

/** Seconds of game played at a clock moment: halves run back to back (overtime counts as a third). */
export function elapsedAt(half: number, clockSeconds: number, halfSeconds: number): number {
  return (half - 1) * halfSeconds + Math.max(0, halfSeconds - clockSeconds)
}

const order = (halfSeconds: number) => (a: Lineup, b: Lineup) =>
  elapsedAt(a.half, a.clock_seconds, halfSeconds) - elapsedAt(b.half, b.clock_seconds, halfSeconds) ||
  a.created_at.localeCompare(b.created_at)

/** Lineups saved within this many seconds of kickoff still count as "from kickoff". */
export const KICKOFF_GRACE = 60

/**
 * True when this team's lineup was saved from the start of the game. Minutes from a lineup first
 * saved mid-game (say with 0:49 left) would be misleading, so they are not shown or counted.
 */
export function trackedFromKickoff(lineups: Lineup[], teamId: string, halfSeconds: number): boolean {
  const mine = lineups.filter((l) => l.team_id === teamId)
  if (!mine.length) return false
  return Math.min(...mine.map((l) => elapsedAt(l.half, l.clock_seconds, halfSeconds))) <= KICKOFF_GRACE
}

/** The team's players on the field right now, or null before kickoff. */
export function currentLineup(lineups: Lineup[], teamId: string, halfSeconds: number): string[] | null {
  const mine = lineups.filter((l) => l.team_id === teamId).sort(order(halfSeconds))
  return mine.at(-1)?.on_field ?? null
}

/** Seconds each player has been on the field, up to `nowElapsed` seconds of game played. */
export function playingTime(lineups: Lineup[], halfSeconds: number, nowElapsed: number): Map<string, number> {
  const out = new Map<string, number>()
  const byTeam = new Map<string, Lineup[]>()
  for (const l of lineups) byTeam.set(l.team_id, [...(byTeam.get(l.team_id) ?? []), l])
  for (const list of byTeam.values()) {
    list.sort(order(halfSeconds))
    list.forEach((l, i) => {
      const from = elapsedAt(l.half, l.clock_seconds, halfSeconds)
      const next = list[i + 1]
      const to = Math.min(nowElapsed, next ? elapsedAt(next.half, next.clock_seconds, halfSeconds) : nowElapsed)
      if (to <= from) return
      for (const p of l.on_field) out.set(p, (out.get(p) ?? 0) + (to - from))
    })
  }
  return out
}

/** Seconds of game played so far, from the saved clock. */
export function gameElapsed(clock: GameClock | null | undefined, halfSeconds: number, now: number): number {
  if (!clock) return 0
  const left = Math.ceil(remainingMs({ running: clock.running, secondsLeft: clock.seconds_left, startedAt: clock.started_at ? Date.parse(clock.started_at) : null }, now) / 1000)
  return elapsedAt(clock.half, left, halfSeconds)
}

/** "12:30" from seconds. */
export const minutesText = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// ── Data ────────────────────────────────────────────────────────────────────

export const lineupKeys = {
  game: (id: string) => ['game', id, 'lineups'] as const,
  all: ['lineups'] as const,
  lastBench: (teamId: string) => ['lineups', 'last-bench', teamId] as const,
}

const COLS = 'id, game_id, team_id, on_field, half, clock_seconds, created_at'

export function useGameLineups(gameId: string | undefined) {
  return useQuery({
    queryKey: lineupKeys.game(gameId ?? ''),
    enabled: !!gameId,
    queryFn: () => rows<Lineup[]>(supabase.from('lineups').select(COLS).eq('game_id', gameId!).is('voided_at', null)),
  })
}

/** Every lineup in the league with each game's clock: for minutes played on profiles. Small league, so one fetch. */
export function useAllLineups() {
  return useQuery({
    queryKey: lineupKeys.all,
    queryFn: async () => {
      const [lineups, clocks] = await Promise.all([
        rows<Lineup[]>(supabase.from('lineups').select(COLS).is('voided_at', null)),
        rows<GameClock[]>(supabase.from('game_clocks').select('*')),
      ])
      return { lineups, clocks }
    },
  })
}

/** Who sat first for this team in its most recent other game, to suggest at kickoff. */
export function useLastBench(teamId: string, gameId: string, roster: string[]) {
  return useQuery({
    queryKey: [...lineupKeys.lastBench(teamId), gameId],
    queryFn: async () => {
      const list = await rows<Lineup[]>(
        supabase.from('lineups').select(COLS).eq('team_id', teamId).neq('game_id', gameId).is('voided_at', null).order('created_at', { ascending: false }).limit(40),
      )
      const lastGame = list[0]?.game_id
      const first = list.filter((l) => l.game_id === lastGame).at(-1)
      return first ? roster.find((p) => !first.on_field.includes(p)) ?? null : null
    },
  })
}

/** Save a lineup: kickoff or a sub. */
export function useSetLineup(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['game-write', 'lineup'],
    mutationFn: (l: Omit<Lineup, 'game_id' | 'created_at'>) => {
      if (!game) throw new Error('Request failed')
      return rows<null>(supabase.from('lineups').upsert({ ...l, game_id: game.id }))
    },
    onMutate: async (l) => {
      if (!game) return
      await qc.cancelQueries({ queryKey: lineupKeys.game(game.id) })
      qc.setQueryData<Lineup[]>(lineupKeys.game(game.id), (old) => [...(old ?? []), { ...l, game_id: game.id, created_at: new Date().toISOString() }])
    },
    onSettled: () => {
      if (!game) return
      void qc.invalidateQueries({ queryKey: lineupKeys.game(game.id) })
      void qc.invalidateQueries({ queryKey: lineupKeys.all })
    },
  })
}

/** One player's time on the field across every tracked game, and which games those were. */
export function playerMinutes(
  lineups: Lineup[],
  clocks: GameClock[],
  playerId: string,
  halfSeconds: number,
  now: number,
): { seconds: number; gameIds: string[] } {
  const clockOf = new Map(clocks.map((c) => [c.game_id, c]))
  const byGame = new Map<string, Lineup[]>()
  for (const l of lineups) byGame.set(l.game_id, [...(byGame.get(l.game_id) ?? []), l])
  let seconds = 0
  const gameIds: string[] = []
  for (const [gameId, list] of byGame) {
    const teamId = list.find((l) => l.on_field.includes(playerId))?.team_id
    if (!teamId || !trackedFromKickoff(list, teamId, halfSeconds)) continue
    gameIds.push(gameId)
    seconds += playingTime(list, halfSeconds, gameElapsed(clockOf.get(gameId), halfSeconds, now)).get(playerId) ?? 0
  }
  return { seconds, gameIds }
}

/** A player's stat totals in just the given games (the ones with playing time). */
export function usePlayerStatsIn(playerId: string | undefined, gameIds: string[]) {
  return useQuery({
    queryKey: ['lineups', 'player-stats', playerId, [...gameIds].sort().join(',')],
    enabled: !!playerId && gameIds.length > 0,
    queryFn: () =>
      rows<{ stat_type_id: string; value: number }[]>(
        supabase.from('stat_events').select('stat_type_id, value').eq('player_id', playerId!).in('game_id', gameIds).is('voided_at', null),
      ),
    select: (list) => {
      const out: Record<string, number> = {}
      for (const r of list) out[r.stat_type_id] = (out[r.stat_type_id] ?? 0) + r.value
      return out
    },
  })
}
