import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { rows } from '../league/api'
import type { LogGame } from './card'

type PointsRow = Omit<LogGame, 'home_team_id' | 'away_team_id'>

/** Every final game a player played, all seasons, with each game's two teams (view player_game_points). */
export function useGameLog(playerId: string | undefined) {
  return useQuery({
    queryKey: ['game-log', playerId ?? ''],
    enabled: !!playerId,
    queryFn: async (): Promise<LogGame[]> => {
      const list = await rows<PointsRow[]>(
        supabase.from('player_game_points').select('game_id, season_id, week, starts_at, points, stats').eq('player_id', playerId!),
      )
      if (list.length === 0) return []
      const games = await rows<{ id: string; home_team_id: string | null; away_team_id: string | null }[]>(
        supabase.from('games').select('id, home_team_id, away_team_id').in('id', list.map((r) => r.game_id)),
      )
      const byId = new Map(games.map((x) => [x.id, x]))
      return list.map((r) => ({
        ...r,
        points: Number(r.points),
        home_team_id: byId.get(r.game_id)?.home_team_id ?? null,
        away_team_id: byId.get(r.game_id)?.away_team_id ?? null,
      }))
    },
  })
}
