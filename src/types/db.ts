/*
 * Row shapes from supabase/schema.sql (hand-kept for Phase 1a; switch to generated types when the
 * Supabase CLI is set up). Only the columns the app reads are listed.
 */
export type TeamColor = 'demons' | 'daybies' | 'tigers' | 'gooners' | 'sucks' | 'spicy' | 'shpitzy'

export interface Player {
  id: string
  full_name: string
  nickname: string | null
  login_name: string | null
  jersey: number | null
  positions: string[]
  birth_year: number | null
  height_in: number | null
  weight_lb: number | null
  photo_path: string | null
  achievements: string
  is_guest: boolean
  voided_at: string | null
}

export interface Team {
  id: string
  name: string
  short_name: string
  color_key: TeamColor
  logo_path: string | null
  photo_path: string | null
  season_id: string
  captain_player_id: string | null
  voided_at: string | null
}

export interface RosterMembership {
  id: string
  player_id: string
  team_id: string
  starts_on: string
  ends_on: string | null
  voided_at: string | null
}

export interface Season {
  id: string
  name: string
  status: 'regular' | 'playoffs' | 'finished'
  counts_for_standings: boolean
  games_planned: number | null
  starts_on: string | null
  half_minutes: number | null
  halftime_minutes: number | null
  overtime_minutes: number | null
  on_field: number | null
  voided_at: string | null
}

export type GameStatus = 'scheduled' | 'live' | 'halftime' | 'final'

export interface Game {
  id: string
  season_id: string
  week: number | null
  starts_at: string | null
  field: string | null
  home_team_id: string | null
  away_team_id: string | null
  status: GameStatus
  kind: 'regular' | 'playoff'
  home_qb_id: string | null
  away_qb_id: string | null
  voided_at: string | null
}

export interface GameScoreRow {
  game_id: string
  home_points: number
  away_points: number
}

export interface StandingRow {
  season_id: string
  team_id: string
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
  games_played: number
  win_pct: number
  point_diff: number
  rank: number
}

export type StatTypeId =
  | 'rec'
  | 'target'
  | 'drop'
  | 'td'
  | 'fumble'
  | 'int'
  | 'pick6'
  | 'conv1'
  | 'conv2'
  | 'block'
  | 'conv_old'
  | 'completion'
  | 'incompletion'
  | 'pass_td'
  | 'int_thrown'
  | 'qb_run'
  | 'qb_rush_td'
  | 'rollout'
  | 'sack_taken'
  | 'fumble_lost'
  | 'pass_first_down'
  | 'rush_first_down'
  | 'rec_td'
  | 'first_down_catch'
  | 'sack_allowed'
  | 'pressure_allowed'
  | 'blocking_penalty'
  | 'sack'
  | 'pass_defended'
  | 'forced_fumble'
  | 'fumble_recovery'
  | 'safety'
  | 'two_hand_touch'
  | 'kickoff_return'
  | 'punt_return'
  | 'return_td'
  | 'touchback'
  | 'onside_recovery'
  | 'kickoff'
  | 'punt'
  | 'penalty'
  | 'first_down'
  | 'turnover'

export interface StatTotalRow {
  season_id: string
  player_id: string
  stat_type_id: StatTypeId
  total: number
}

export type StatGroup = 'qb' | 'receiving' | 'line' | 'defense' | 'kicks' | 'team' | 'legacy'

export interface StatType {
  id: StatTypeId
  label: string
  display_order: number
  active: boolean
  team_level: boolean
  fantasy_points: number
  stat_group: StatGroup
  max_per_game: number | null
}

/** One stat line (database table stat_events). Totals are worked out from these, never stored. */
export interface StatEvent {
  id: string
  season_id: string
  game_id: string | null
  team_id: string | null
  player_id: string | null
  stat_type_id: StatTypeId
  value: number
  half: 1 | 2 | 3 | null
  clock_seconds: number | null
  voided_at: string | null
  created_at: string
}

/** Who came into the game for a player (database table game_subs). */
export interface GameSub {
  id: string
  game_id: string
  team_id: string
  player_id: string
  voided_at: string | null
  created_at: string
}

/** Minutes one player was on the field in one game (database table player_minutes). */
export interface PlayerMinutes {
  id: string
  game_id: string
  player_id: string
  minutes: number
  voided_at: string | null
  created_at: string
}

export interface Settings {
  half_minutes: number
  halftime_minutes: number
  default_field: string
  time_zone: string
}

export type ScoringTypeId = 'td' | 'conv1' | 'conv2' | 'safety' | 'final_manual'

export interface ScoreEvent {
  id: string
  game_id: string
  team_id: string
  scoring_type_id: ScoringTypeId
  points: number
  player_id: string | null
  clock_seconds?: number | null // newer column; optional so existing writers still type-check
  voided_at: string | null
  created_at: string
}

export interface GameClock {
  game_id: string
  running: boolean
  seconds_left: number
  started_at: string | null
  half: 1 | 2 | 3
}

export interface Trade {
  id: string
  traded_on: string
  team_a_id: string
  team_b_id: string
  players_a: string[]
  players_b: string[]
  note: string | null
  voided_at: string | null
}

/** Estimates (database view player_projections): per game, from career totals. */
export interface PlayerProjection {
  player_id: string
  team_id: string
  games: number
  rec_per_game: number
  td_per_game: number
  int_per_game: number
  points_total: number
  points_per_game: number
}

/** Estimates (database view game_projections) for games not yet final. */
export interface GameProjection {
  game_id: string
  season_id: string
  home_points: number
  away_points: number
  home_win_chance: number
}

/** Every table "Export everything" saves, in a safe restore order. */
export const EXPORT_TABLES = [
  'settings', 'seasons', 'scoring_types', 'stat_types', 'teams', 'players', 'roster_memberships',
  'member_logins', 'games', 'game_clocks', 'score_events', 'stat_events', 'record_adjustments', 'trades', 'edit_history',
] as const
