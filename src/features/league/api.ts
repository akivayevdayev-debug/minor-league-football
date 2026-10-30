/*
 * League data door: reading and changing players, teams, rosters, seasons and games.
 * Screens call these hooks; none of them talk to Supabase directly. Voided rows are filtered here.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  Game, GameProjection, GameScoreRow, Player, PlayerProjection, RosterMembership, Season, Settings, StandingRow, StatTotalRow, StatType, StatTypeId, Team,
} from '../../types/db'

/**
 * Errors shown to people never carry database details (security checklist, item 12).
 * The one exception: messages our own database actions raise on purpose (code 22023, plain English,
 * e.g. "Scores must be between 0 and 200.").
 */
export async function rows<T>(query: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<T> {
  const { data, error } = await query
  if (error) {
    console.error(error)
    throw new Error(error.code === '22023' ? error.message : 'Request failed')
  }
  return data as T
}

export const keys = {
  teams: ['teams'] as const,
  players: ['players'] as const,
  rosters: ['rosters'] as const,
  seasons: ['seasons'] as const,
  games: (seasonId: string) => ['games', seasonId] as const,
  scores: (seasonId: string) => ['scores', seasonId] as const,
  standings: (seasonId: string) => ['standings', seasonId] as const,
  statTotals: ['stat-totals'] as const,
  statTypes: ['stat-types'] as const,
  settings: ['settings'] as const,
  playerProjections: ['player-projections'] as const,
  gameProjections: (seasonId: string) => ['game-projections', seasonId] as const,
}

export function useTeams() {
  return useQuery({
    queryKey: keys.teams,
    queryFn: () => rows<Team[]>(supabase.from('teams').select('*').is('voided_at', null).order('name')),
  })
}

export function usePlayers() {
  return useQuery({
    queryKey: keys.players,
    queryFn: () =>
      rows<Player[]>(supabase.from('players').select('*').is('voided_at', null).order('is_guest').order('full_name')),
  })
}

/** All roster lines, open and closed (closed = history). */
export function useRosters() {
  return useQuery({
    queryKey: keys.rosters,
    queryFn: () =>
      rows<RosterMembership[]>(
        supabase.from('roster_memberships').select('*').is('voided_at', null).order('starts_on', { ascending: false }),
      ),
  })
}

/** The season the schedule shows: newest one that counts for standings and isn't finished. */
export function useCurrentSeason() {
  return useQuery({
    queryKey: keys.seasons,
    queryFn: () =>
      rows<Season[]>(supabase.from('seasons').select('*').is('voided_at', null).order('starts_on', { ascending: false })),
    select: (seasons) =>
      seasons.find((s) => s.counts_for_standings && s.status !== 'finished') ?? seasons.find((s) => s.counts_for_standings) ?? null,
  })
}

export function useGames(seasonId: string | undefined) {
  return useQuery({
    queryKey: keys.games(seasonId ?? ''),
    enabled: !!seasonId,
    queryFn: () =>
      rows<Game[]>(
        supabase
          .from('games')
          .select('*')
          .eq('season_id', seasonId!)
          .is('voided_at', null)
          .order('week', { ascending: true, nullsFirst: false })
          .order('starts_at', { ascending: true, nullsFirst: false }),
      ),
  })
}

export function useGameScores(seasonId: string | undefined) {
  return useQuery({
    queryKey: keys.scores(seasonId ?? ''),
    enabled: !!seasonId,
    queryFn: () =>
      rows<GameScoreRow[]>(supabase.from('game_scores').select('game_id, home_points, away_points').eq('season_id', seasonId!)),
    select: (list) => new Map(list.map((s) => [s.game_id, s])),
  })
}

/** Table for one season, best first (the database decides the order: win %, then point difference, then points for). */
export function useStandings(seasonId: string | undefined) {
  return useQuery({
    queryKey: keys.standings(seasonId ?? ''),
    enabled: !!seasonId,
    queryFn: () =>
      rows<StandingRow[]>(supabase.from('standings').select('*').eq('season_id', seasonId!).order('rank', { ascending: true })),
  })
}

export type StatTotals = Map<string, Partial<Record<StatTypeId, number>>>

/** Career totals per player (all seasons, including "Earlier totals"): player id → stat → total. */
export function useStatTotals() {
  return useQuery({
    queryKey: keys.statTotals,
    queryFn: () => rows<StatTotalRow[]>(supabase.from('player_stat_totals').select('player_id, stat_type_id, total')),
    select: (list): StatTotals => {
      const out: StatTotals = new Map()
      for (const r of list) {
        const p = out.get(r.player_id) ?? {}
        p[r.stat_type_id] = (p[r.stat_type_id] ?? 0) + r.total
        out.set(r.player_id, p)
      }
      return out
    },
  })
}

export function useAddGuest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fullName: string) =>
      rows<Player>(supabase.from('players').insert({ full_name: fullName.trim(), is_guest: true }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.players }),
  })
}

export type PlayerChanges = Partial<Pick<Player, 'nickname' | 'jersey' | 'positions' | 'achievements' | 'voided_at'>>

export function useUpdatePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: PlayerChanges }) =>
      rows<Player>(supabase.from('players').update(changes).eq('id', id).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.players }),
  })
}

/** Closes the player's current team line and opens a new one (or none) from a date. */
export function useMovePlayer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ playerId, teamId, on }: { playerId: string; teamId: string | null; on: string }) =>
      rows<null>(supabase.rpc('move_player', { p_player_id: playerId, p_team_id: teamId, p_on: on })),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.rosters }),
  })
}

export type NewGame = Pick<Game, 'season_id' | 'week' | 'starts_at' | 'home_team_id' | 'away_team_id'> & Partial<Pick<Game, 'kind'>>

export function useAddGame() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (game: NewGame) => rows<Game>(supabase.from('games').insert(game).select().single()),
    onSuccess: (game) => qc.invalidateQueries({ queryKey: keys.games(game.season_id) }),
  })
}

/** Change a game's time. Returns the old time so the toast can offer Undo. */
export function useRescheduleGame() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ game, startsAt }: { game: Game; startsAt: string | null }) =>
      rows<Game>(supabase.from('games').update({ starts_at: startsAt }).eq('id', game.id).select().single()),
    onSuccess: (game) => qc.invalidateQueries({ queryKey: keys.games(game.season_id) }),
  })
}

/** League settings (one row): half length, halftime length, default field. */
export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    staleTime: 5 * 60_000,
    queryFn: () =>
      rows<Settings>(supabase.from('settings').select('half_minutes, halftime_minutes, default_field, time_zone').eq('id', 1).single()),
  })
}

/** Stat kinds in their set order, with how many fantasy points each is worth. */
export function useStatTypes() {
  return useQuery({
    queryKey: keys.statTypes,
    staleTime: 5 * 60_000,
    queryFn: () => rows<StatType[]>(supabase.from('stat_types').select('*').eq('active', true).order('display_order')),
  })
}

/** Estimates per player (per game). Empty until change 003 is in the database. */
export function usePlayerProjections() {
  return useQuery({
    queryKey: keys.playerProjections,
    retry: 0,
    queryFn: () => rows<PlayerProjection[]>(supabase.from('player_projections').select('*')),
    select: (list) => new Map(list.map((p) => [p.player_id, p])),
  })
}

/** Estimated score and win chance for each game that isn't final yet. */
export function useGameProjections(seasonId: string | undefined) {
  return useQuery({
    queryKey: keys.gameProjections(seasonId ?? ''),
    enabled: !!seasonId,
    retry: 0,
    queryFn: () => rows<GameProjection[]>(supabase.from('game_projections').select('*').eq('season_id', seasonId!)),
    select: (list) => new Map(list.map((p) => [p.game_id, p])),
  })
}

function invalidateResults(qc: ReturnType<typeof useQueryClient>, seasonId: string) {
  for (const key of [keys.games(seasonId), keys.scores(seasonId), keys.standings(seasonId), keys.gameProjections(seasonId), keys.playerProjections]) {
    void qc.invalidateQueries({ queryKey: key })
  }
}

/** Type in a final score in one step (older score lines are voided, never deleted). */
export function useSetFinalScore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ game, home, away }: { game: Game; home: number; away: number }) =>
      rows<null>(supabase.rpc('set_final_score', { p_game_id: game.id, p_home: home, p_away: away })),
    onSuccess: (_d, { game }) => {
      invalidateResults(qc, game.season_id)
      void qc.invalidateQueries({ queryKey: ['game', game.id] })
    },
  })
}

export interface NewStat {
  stat_type_id: StatTypeId
  value: number
}

/** Adds stat lines for one player (a game's stats, or season stats when no game is picked). */
export function useAddStats() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seasonId, gameId, teamId, playerId, stats }: { seasonId: string; gameId: string | null; teamId: string | null; playerId: string; stats: NewStat[] }) =>
      rows<null>(
        supabase.from('stat_events').insert(
          stats
            .filter((s) => s.value !== 0)
            .map((s) => ({ id: crypto.randomUUID(), season_id: seasonId, game_id: gameId, team_id: teamId, player_id: playerId, stat_type_id: s.stat_type_id, value: s.value })),
        ),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.statTotals })
      void qc.invalidateQueries({ queryKey: keys.playerProjections })
    },
  })
}

/** Swap players between two teams from a date, and keep a record of the trade. */
export function useMakeTrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (t: { teamA: string; playersA: string[]; teamB: string; playersB: string[]; on: string; note: string }) =>
      rows<string>(
        supabase.rpc('make_trade', { p_team_a: t.teamA, p_players_a: t.playersA, p_team_b: t.teamB, p_players_b: t.playersB, p_on: t.on, p_note: t.note || null }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.rosters })
      void qc.invalidateQueries({ queryKey: keys.playerProjections })
    },
  })
}
