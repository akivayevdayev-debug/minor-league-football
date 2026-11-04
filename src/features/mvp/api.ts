import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { rows } from '../league/api'
import type { GamePoints, Pin } from './race'

export interface PinRow extends Pin {
  id: string
}

const mvpKeys = {
  points: (seasonId: string) => ['mvp-points', seasonId] as const,
  pins: (seasonId: string) => ['mvp-pins', seasonId] as const,
}

/** Each player's fantasy points in every final game they played this season (view player_game_points). */
export function useGamePoints(seasonId: string | undefined) {
  return useQuery({
    queryKey: mvpKeys.points(seasonId ?? ''),
    enabled: !!seasonId,
    queryFn: async () =>
      (
        await rows<GamePoints[]>(
          supabase.from('player_game_points').select('player_id, game_id, week, points, stats').eq('season_id', seasonId!),
        )
      ).map((r) => ({ ...r, points: Number(r.points) })),
  })
}

/** Places Eddie or Akiva pinned this season (live ones only). */
export function useMvpPins(seasonId: string | undefined) {
  return useQuery({
    queryKey: mvpKeys.pins(seasonId ?? ''),
    enabled: !!seasonId,
    queryFn: () =>
      rows<PinRow[]>(
        supabase.from('mvp_pins').select('id, player_id, place, pinned_by').eq('season_id', seasonId!).is('voided_at', null).order('place'),
      ),
  })
}

/** Pins a player to a place. A player already pinned elsewhere is moved (old pin voided first). */
export function usePinPlayer(seasonId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ playerId, place, replace }: { playerId: string; place: number; replace: string[] }) => {
      if (replace.length > 0) {
        await rows(supabase.from('mvp_pins').update({ voided_at: new Date().toISOString() }).in('id', replace).select('id'))
      }
      await rows(supabase.from('mvp_pins').insert({ season_id: seasonId!, player_id: playerId, place }).select('id'))
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: mvpKeys.pins(seasonId ?? '') }),
  })
}

/** Removes a pin (voids it; nothing is deleted). */
export function useUnpin(seasonId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      rows(supabase.from('mvp_pins').update({ voided_at: new Date().toISOString() }).eq('id', id).select('id')),
    onSettled: () => void qc.invalidateQueries({ queryKey: mvpKeys.pins(seasonId ?? '') }),
  })
}
