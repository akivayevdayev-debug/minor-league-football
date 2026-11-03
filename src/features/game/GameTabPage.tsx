/*
 * The /game route no longer has a tab. It sends you to the game to play: ?id= opens that game,
 * else the live game, else the next game not yet final in the active season, else the Schedule.
 */
import { Navigate, useSearchParams } from 'react-router-dom'
import { activeSeason, useGames, useSeasons } from '../league'
import type { Game } from '../../types/db'
import { Skeleton } from '../../ui/Skeleton'

/** Live or halftime first, then the next scheduled game: lowest week, then earliest start. */
function nextUnfinished(games: Game[]): Game | undefined {
  const open = games.filter((g) => !g.voided_at && g.status !== 'final' && g.home_team_id && g.away_team_id)
  const rank = (g: Game) => (g.status === 'live' || g.status === 'halftime' ? 0 : 1)
  return [...open].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.week ?? Infinity) - (b.week ?? Infinity) ||
      (a.starts_at ?? '￿').localeCompare(b.starts_at ?? '￿'),
  )[0]
}

export default function GameTabPage() {
  const [params] = useSearchParams()
  const seasons = useSeasons()
  const season = activeSeason(seasons.data ?? [])
  const games = useGames(season?.id)
  const chosen = params.get('id')

  if (chosen) return <Navigate to={`/game/${chosen}`} replace />
  if (seasons.isPending || (season && games.isPending)) return <div className="p-4"><Skeleton rows={5} /></div>
  const next = season ? nextUnfinished(games.data ?? []) : undefined
  return <Navigate to={next ? `/game/${next.id}` : '/schedule'} replace />
}
