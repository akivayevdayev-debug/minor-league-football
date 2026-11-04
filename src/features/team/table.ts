/*
 * The Team tab's stats table: which stat codes go in which column, week and season counts per
 * player, which columns to show, and how a cell reads. Pure functions, tested without a database.
 */
import type { StatTypeId } from '../../types/db'
import type { GamePoints } from '../mvp/race'
import type { WeekRow } from './week'

export interface TableColumn {
  key: string
  label: string
  title: string
  /** Stat codes whose counts add into this column. */
  codes: StatTypeId[]
}

/** Column order is fixed; the table shows them left to right in this order. */
export const TABLE_COLUMNS: TableColumn[] = [
  { key: 'pass_td', label: 'Pass TD', title: 'Passing touchdowns', codes: ['pass_td'] },
  { key: 'td', label: 'TD', title: 'Touchdowns', codes: ['td', 'rec_td', 'qb_rush_td', 'return_td'] },
  { key: 'rec', label: 'Rec', title: 'Receptions', codes: ['rec'] },
  { key: 'int', label: 'INT', title: 'Interceptions', codes: ['int'] },
  { key: 'pick6', label: 'Pick 6', title: 'Pick sixes', codes: ['pick6'] },
  { key: 'sack', label: 'Sack', title: 'Sacks', codes: ['sack'] },
  { key: 'block', label: 'Blk', title: 'Blocks', codes: ['block'] },
  { key: 'int_thrown', label: 'INT thr', title: 'Interceptions thrown', codes: ['int_thrown'] },
  { key: 'rollout', label: 'Rollout', title: 'Rollouts', codes: ['rollout'] },
  { key: 'sack_taken', label: 'Sack tkn', title: 'Sacks taken', codes: ['sack_taken'] },
  { key: 'sack_allowed', label: 'Sack alw', title: 'Sacks allowed', codes: ['sack_allowed'] },
]

/** Counts keyed by TableColumn.key. Zero totals are left out. */
export type StatCounts = Record<string, number>

const COLUMN_BY_CODE = new Map<string, string>(
  TABLE_COLUMNS.flatMap((column) => column.codes.map((code) => [code, column.key] as const)),
)

/** Adds each stat code's count into its column. Codes that are in no column are ignored. */
function addInto(counts: StatCounts, code: string, value: number) {
  const key = COLUMN_BY_CODE.get(code)
  if (!key) return
  counts[key] = (counts[key] ?? 0) + value
}

/** One player's counts for a single week, from the breakdown on their row. */
export function weekCounts(row: WeekRow): StatCounts {
  const counts: StatCounts = {}
  for (const line of row.breakdown) addInto(counts, line.statTypeId, line.value)
  return dropZeros(counts)
}

/** One player's totals across every game they have points in. */
export function seasonCounts(games: GamePoints[], playerId: string): { games: number; points: number; counts: StatCounts } {
  const mine = games.filter((g) => g.player_id === playerId)
  const counts: StatCounts = {}
  let points = 0
  for (const game of mine) {
    points += game.points
    for (const [code, value] of Object.entries(game.stats)) addInto(counts, code, value)
  }
  return { games: mine.length, points, counts: dropZeros(counts) }
}

/** The columns with a non-zero total for at least one player, in the fixed order. */
export function visibleColumns(countsByPlayer: StatCounts[]): TableColumn[] {
  return TABLE_COLUMNS.filter((column) => countsByPlayer.some((counts) => (counts[column.key] ?? 0) !== 0))
}

/** What a cell shows: the count, or a dash for zero or missing. */
export function cell(counts: StatCounts, key: string): string {
  const value = counts[key]
  return value ? String(value) : '–'
}

function dropZeros(counts: StatCounts): StatCounts {
  return Object.fromEntries(Object.entries(counts).filter(([, value]) => value !== 0))
}
