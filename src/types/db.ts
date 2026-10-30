/*
 * Row shapes from supabase/schema.sql (hand-kept for Phase 1a; switch to generated types when the
 * Supabase CLI is set up). Only the columns the app reads are listed.
 */
export type TeamColor = 'demons' | 'daybies' | 'tigers'

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
  achievements: string
  is_guest: boolean
  voided_at: string | null
}

export interface Team {
  id: string
  name: string
  short_name: string
  color_key: TeamColor
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

export type StatTypeId = 'rec' | 'target' | 'drop' | 'td' | 'fumble' | 'int' | 'pick6' | 'conv1' | 'conv2' | 'block' | 'conv_old'

export interface StatTotalRow {
  season_id: string
  player_id: string
  stat_type_id: StatTypeId
  total: number
}

/** Every table "Export everything" saves, in a safe restore order. */
export const EXPORT_TABLES = [
  'settings', 'seasons', 'scoring_types', 'stat_types', 'teams', 'players', 'roster_memberships',
  'member_logins', 'games', 'score_events', 'stat_events', 'record_adjustments', 'edit_history',
] as const
