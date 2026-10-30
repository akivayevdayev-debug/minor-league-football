/*
 * Game-night data: one game's score lines, clock and status, kept live with Supabase Realtime.
 * The clock stores only state changes (started at / seconds left); phones count down themselves
 * using server time, so every phone shows the same clock.
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { keys as leagueKeys, rows } from '../league/api'
import type { Game, GameClock, GameStatus, ScoreEvent, ScoringTypeId, StatTypeId } from '../../types/db'

export const gameKeys = {
  game: (id: string) => ['game', id] as const,
  scoreEvents: (id: string) => ['game', id, 'score-events'] as const,
  clock: (id: string) => ['game', id, 'clock'] as const,
  stats: (id: string) => ['game', id, 'stat-events'] as const,
}

export function useGame(id: string | undefined) {
  return useQuery({
    queryKey: gameKeys.game(id ?? ''),
    enabled: !!id,
    queryFn: () => rows<Game>(supabase.from('games').select('*').eq('id', id!).single()),
  })
}

export function useScoreEvents(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.scoreEvents(gameId ?? ''),
    enabled: !!gameId,
    queryFn: () =>
      rows<ScoreEvent[]>(
        supabase.from('score_events').select('*').eq('game_id', gameId!).is('voided_at', null).order('created_at', { ascending: true }),
      ),
  })
}

export function useGameClock(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.clock(gameId ?? ''),
    enabled: !!gameId,
    queryFn: async () => {
      const { data, error } = await supabase.from('game_clocks').select('*').eq('game_id', gameId!).maybeSingle()
      // PGRST205: the clock table isn't in the database yet (change 003). Show a fresh clock instead of failing.
      if (error?.code === 'PGRST205') return null
      if (error) throw new Error('Request failed')
      return data as GameClock | null
    },
  })
}

/** Phone clock minus server clock, measured once (half the round trip is allowed for). */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    let alive = true
    const t0 = Date.now()
    void supabase.rpc('server_now').then(({ data, error }) => {
      if (!alive || error || typeof data !== 'string') return
      const t1 = Date.now()
      setOffset(new Date(data).getTime() - (t0 + t1) / 2)
    })
    return () => {
      alive = false
    }
  }, [])
  return offset
}

/** Every open game screen hears score, clock and status changes the moment they happen. */
export function useLiveGame(gameId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!gameId) return
    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_events', filter: `game_id=eq.${gameId}` }, () =>
        qc.invalidateQueries({ queryKey: gameKeys.scoreEvents(gameId) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stat_events', filter: `game_id=eq.${gameId}` }, () =>
        qc.invalidateQueries({ queryKey: gameKeys.stats(gameId) }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_clocks', filter: `game_id=eq.${gameId}` }, () =>
        qc.invalidateQueries({ queryKey: gameKeys.clock(gameId) }),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, () =>
        qc.invalidateQueries({ queryKey: gameKeys.game(gameId) }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gameId, qc])
}

/** One stat line logged during a game (the live stat pad and the box score read these). */
export interface GameStat {
  id: string
  team_id: string | null
  player_id: string | null
  stat_type_id: StatTypeId
  value: number
  half: number | null
  created_at: string
}

export function useGameStats(gameId: string | undefined) {
  return useQuery({
    queryKey: gameKeys.stats(gameId ?? ''),
    enabled: !!gameId,
    queryFn: () =>
      rows<GameStat[]>(
        supabase
          .from('stat_events')
          .select('id, team_id, player_id, stat_type_id, value, half, created_at')
          .eq('game_id', gameId!)
          .is('voided_at', null)
          .order('created_at', { ascending: true }),
      ),
  })
}

/** Optimistic helper: change this game's stat lines on screen now, put them back if saving fails. */
function useStatLinesOptimism(game: Game | undefined) {
  const qc = useQueryClient()
  return {
    async apply(change: (lines: GameStat[]) => GameStat[]) {
      if (!game) return { before: undefined }
      const key = gameKeys.stats(game.id)
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<GameStat[]>(key)
      qc.setQueryData<GameStat[]>(key, change(before ?? []))
      return { before }
    },
    rollback(ctx: { before: GameStat[] | undefined } | undefined) {
      if (game && ctx) qc.setQueryData(gameKeys.stats(game.id), ctx.before)
    },
    settle() {
      if (!game) return
      void qc.invalidateQueries({ queryKey: gameKeys.stats(game.id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.statTotals })
      void qc.invalidateQueries({ queryKey: leagueKeys.playerProjections })
    },
  }
}

/**
 * Logs one stat line for a player (or for a team when playerId is null). The id is made on the
 * phone, so a retry after a dropped signal can never save it twice. value is +1 for a tap, or the
 * difference when someone types a new total.
 */
export function useLogStat(game: Game | undefined) {
  const o = useStatLinesOptimism(game)
  return useMutation({
    mutationKey: ['game-write', 'stat'],
    mutationFn: async (line: Omit<GameStat, 'created_at'>) => {
      if (!game) throw new Error('Request failed')
      await rows<null>(supabase.from('stat_events').upsert({ ...line, season_id: game.season_id, game_id: game.id }))
    },
    onMutate: (line) => o.apply((lines) => [...lines, { ...line, created_at: new Date().toISOString() }]),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: () => o.settle(),
  })
}

/** Undo a stat line: voided, kept in the edit history. */
export function useVoidStat(game: Game | undefined) {
  const o = useStatLinesOptimism(game)
  return useMutation({
    mutationKey: ['game-write', 'void-stat'],
    mutationFn: (id: string) => rows<null>(supabase.from('stat_events').update({ voided_at: new Date().toISOString() }).eq('id', id)),
    onMutate: (id) => o.apply((lines) => lines.filter((l) => l.id !== id)),
    onError: (_e, _v, ctx) => o.rollback(ctx),
    onSettled: () => o.settle(),
  })
}

/** One change to this game, from the edit history (who did what, when). */
export interface GameHistoryRow {
  id: number
  table_name: string
  row_id: string
  action: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string
}

/** The edit history for this game's score and stat lines, newest first. */
export function useGameHistory(gameId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['game', gameId ?? '', 'history'],
    enabled: !!gameId && enabled,
    queryFn: () =>
      rows<GameHistoryRow[]>(
        supabase
          .from('edit_history')
          .select('*')
          .in('table_name', ['score_events', 'stat_events'])
          .or(`after->>game_id.eq.${gameId},before->>game_id.eq.${gameId}`)
          .order('changed_at', { ascending: false })
          .limit(60),
      ),
  })
}

const POINTS: Record<Exclude<ScoringTypeId, 'final_manual'>, number> = { td: 6, conv1: 1, conv2: 2 }

/**
 * Adds a score line. If a scorer is picked, a matching stat line is added with the SAME id,
 * so Undo voids both together. Shows on screen at once (optimistic), rolls back if it fails.
 */
export function useAddScore(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['game-write', 'score'],
    mutationFn: async ({ id, teamId, type, playerId, half }: { id: string; teamId: string; type: keyof typeof POINTS; playerId: string | null; half: number }) => {
      if (!game) throw new Error('Request failed')
      await rows<null>(supabase.from('score_events').insert({ id, game_id: game.id, team_id: teamId, scoring_type_id: type, points: POINTS[type], player_id: playerId }))
      if (playerId) {
        await rows<null>(
          supabase.from('stat_events').insert({ id, season_id: game.season_id, game_id: game.id, team_id: teamId, player_id: playerId, stat_type_id: type, value: 1, half }),
        )
      }
    },
    onMutate: async ({ id, teamId, type, playerId }) => {
      if (!game) return
      const key = gameKeys.scoreEvents(game.id)
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<ScoreEvent[]>(key)
      const line: ScoreEvent = { id, game_id: game.id, team_id: teamId, scoring_type_id: type, points: POINTS[type], player_id: playerId, voided_at: null, created_at: new Date().toISOString() }
      qc.setQueryData<ScoreEvent[]>(key, [...(before ?? []), line])
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (game && ctx) qc.setQueryData(gameKeys.scoreEvents(game.id), ctx.before)
    },
    onSettled: () => {
      if (!game) return
      void qc.invalidateQueries({ queryKey: gameKeys.scoreEvents(game.id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.scores(game.season_id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.statTotals })
      void qc.invalidateQueries({ queryKey: gameKeys.stats(game.id) })
    },
  })
}

/** Undo a score line (voided, kept in history) and its matching stat line if there is one. */
export function useVoidScore(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (line: ScoreEvent) => {
      const now = new Date().toISOString()
      await rows<null>(supabase.from('score_events').update({ voided_at: now }).eq('id', line.id))
      if (line.player_id) await rows<null>(supabase.from('stat_events').update({ voided_at: now }).eq('id', line.id))
    },
    onMutate: async (line) => {
      if (!game) return
      const key = gameKeys.scoreEvents(game.id)
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<ScoreEvent[]>(key)
      qc.setQueryData<ScoreEvent[]>(key, (before ?? []).filter((l) => l.id !== line.id))
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (game && ctx) qc.setQueryData(gameKeys.scoreEvents(game.id), ctx.before)
    },
    onSettled: () => {
      if (!game) return
      void qc.invalidateQueries({ queryKey: gameKeys.scoreEvents(game.id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.scores(game.season_id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.statTotals })
      void qc.invalidateQueries({ queryKey: gameKeys.stats(game.id) })
    },
  })
}

export type ClockChange = Pick<GameClock, 'running' | 'seconds_left' | 'started_at' | 'half'>

/** Saves a clock state change (start, pause, new half) and, if given, the game's status. */
export function useSetClock(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ clock, status }: { clock: ClockChange; status?: GameStatus }) => {
      if (!game) throw new Error('Request failed')
      await rows<null>(supabase.from('game_clocks').upsert({ game_id: game.id, ...clock }))
      if (status && status !== game.status) await rows<null>(supabase.from('games').update({ status }).eq('id', game.id))
    },
    onMutate: async ({ clock }) => {
      if (!game) return
      const key = gameKeys.clock(game.id)
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<GameClock | null>(key)
      qc.setQueryData<GameClock>(key, { game_id: game.id, ...clock })
      return { before }
    },
    onError: (_e, _v, ctx) => {
      if (game && ctx) qc.setQueryData(gameKeys.clock(game.id), ctx.before)
    },
    onSettled: () => {
      if (!game) return
      void qc.invalidateQueries({ queryKey: gameKeys.clock(game.id) })
      void qc.invalidateQueries({ queryKey: gameKeys.game(game.id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.games(game.season_id) })
    },
  })
}

/** Marks the game final (scores already added live stay as they are). */
export function useFinishGame(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (secondsLeft: number) => {
      if (!game) throw new Error('Request failed')
      await rows<null>(supabase.from('game_clocks').upsert({ game_id: game.id, running: false, started_at: null, seconds_left: secondsLeft }))
      await rows<null>(supabase.from('games').update({ status: 'final' }).eq('id', game.id))
    },
    onSettled: () => {
      if (!game) return
      for (const key of [gameKeys.game(game.id), gameKeys.clock(game.id), leagueKeys.games(game.season_id), leagueKeys.scores(game.season_id), leagueKeys.standings(game.season_id), leagueKeys.gameProjections(game.season_id)]) {
        void qc.invalidateQueries({ queryKey: key })
      }
    },
  })
}

/** Names the scorer of a line already added ("Who scored?"), and adds their matching stat line. */
export function useCreditScorer(game: Game | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ line, playerId, half }: { line: ScoreEvent; playerId: string; half: number }) => {
      if (!game) throw new Error('Request failed')
      await rows<null>(supabase.from('score_events').update({ player_id: playerId }).eq('id', line.id))
      await rows<null>(
        supabase.from('stat_events').upsert({
          id: line.id, season_id: game.season_id, game_id: game.id, team_id: line.team_id, player_id: playerId,
          stat_type_id: line.scoring_type_id, value: 1, half,
        }),
      )
    },
    onSettled: () => {
      if (!game) return
      void qc.invalidateQueries({ queryKey: gameKeys.scoreEvents(game.id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.statTotals })
      void qc.invalidateQueries({ queryKey: gameKeys.stats(game.id) })
    },
  })
}
