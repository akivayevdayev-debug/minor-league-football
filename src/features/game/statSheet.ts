/*
 * The game stat sheet: type each player's totals for one game, save only the differences.
 * Stats stay event rows: a correction from 3 catches to 5 saves one "+2" line, never an overwrite.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { keys as leagueKeys, rows } from '../league/api'
import type { Game, StatTypeId } from '../../types/db'
import { gameKeys, type GameStat } from './api'

/** Per player, per stat: this game's current totals (lines without a player are team stats, left out). */
export function playerTotals(stats: Pick<GameStat, 'player_id' | 'stat_type_id' | 'value'>[]): Map<string, Map<StatTypeId, number>> {
  const out = new Map<string, Map<StatTypeId, number>>()
  for (const s of stats) {
    if (!s.player_id) continue
    const counts = out.get(s.player_id) ?? new Map<StatTypeId, number>()
    counts.set(s.stat_type_id, (counts.get(s.stat_type_id) ?? 0) + s.value)
    out.set(s.player_id, counts)
  }
  return out
}

export const cellKey = (playerId: string, stat: StatTypeId) => `${playerId}:${stat}`

/** A typed cell: blank means 0; whole numbers 0 to 999 only. Anything else is null (not valid). */
export function readCell(text: string): number | null {
  const t = text.trim()
  if (t === '') return 0
  if (!/^\d{1,3}$/.test(t)) return null
  return Number(t)
}

export interface StatChange {
  player_id: string
  stat_type_id: StatTypeId
  delta: number
}

/** The lines to save: the difference between each typed cell and the current total. Skips unchanged and invalid cells. */
export function sheetChanges(current: Map<string, Map<StatTypeId, number>>, edits: Map<string, string>): StatChange[] {
  const out: StatChange[] = []
  for (const [key, text] of edits) {
    const typed = readCell(text)
    if (typed === null) continue
    const [playerId, stat] = key.split(':') as [string, StatTypeId]
    const delta = typed - (current.get(playerId)?.get(stat) ?? 0)
    if (delta !== 0) out.push({ player_id: playerId, stat_type_id: stat, delta })
  }
  return out
}

/** Saves a stat sheet in one request, so it either all saves or none of it does. */
export function useSaveStatSheet(game: Game) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ changes, teamOf }: { changes: StatChange[]; teamOf: (playerId: string) => string | null }) =>
      rows<null>(
        supabase.from('stat_events').insert(
          changes.map((c) => ({
            id: crypto.randomUUID(),
            season_id: game.season_id,
            game_id: game.id,
            team_id: teamOf(c.player_id),
            player_id: c.player_id,
            stat_type_id: c.stat_type_id,
            value: c.delta,
          })),
        ),
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: gameKeys.stats(game.id) })
      void qc.invalidateQueries({ queryKey: leagueKeys.statTotals })
      void qc.invalidateQueries({ queryKey: leagueKeys.playerProjections })
    },
  })
}
