/*
 * The Game tab: the game clock, score buttons and live stats for tonight's game, right in the app.
 * It opens the game that is live; otherwise the next game to play; otherwise the last one played.
 * The picker at the top switches to any other game of the season.
 */
import { useSearchParams } from 'react-router-dom'
import { useMember } from '../auth'
import { useSeasonSnapshot } from '../league'
import type { Game } from '../../types/db'
import { EmptyState } from '../../ui/EmptyState'
import { Icon } from '../../ui/Icon'
import { Skeleton } from '../../ui/Skeleton'
import { GameScreen } from './LiveGamePage'

/** Ascending comparison with nulls last. */
function nullsLast<T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  return cmp(a, b)
}

/**
 * Live game first (highest week, then latest start). Otherwise the next scheduled game: lowest week
 * still open, then earliest start. Otherwise the last final game.
 */
function pickGame(games: Game[]): Game | undefined {
  const withTeams = games.filter((g) => g.home_team_id && g.away_team_id)
  const [liveGame] = withTeams
    .filter((g) => g.status === 'live' || g.status === 'halftime')
    .sort((a, b) => nullsLast(b.week, a.week, (x, y) => x - y) || nullsLast(b.starts_at, a.starts_at, (x, y) => x.localeCompare(y)))
  if (liveGame) return liveGame
  const [next] = withTeams
    .filter((g) => g.status === 'scheduled')
    .sort((a, b) => nullsLast(a.week, b.week, (x, y) => x - y) || nullsLast(a.starts_at, b.starts_at, (x, y) => x.localeCompare(y)))
  if (next) return next
  return withTeams.filter((g) => g.status === 'final').at(-1)
}

export default function GameTabPage() {
  const member = useMember()
  const snap = useSeasonSnapshot(member.playerId)
  const [params, setParams] = useSearchParams()
  const chosen = params.get('id')
  const setChosen = (id: string) => setParams({ id }, { replace: true })

  if (snap.isPending) return <div className="p-4"><Skeleton rows={5} /></div>
  const games = snap.games.filter((g) => g.home_team_id && g.away_team_id)
  const id = chosen ?? pickGame(snap.games)?.id
  if (!id) return <EmptyState icon="games" title="No games yet" body="Add a game on the Schedule, then run it from here." />

  const short = (teamId: string | null) => (teamId && snap.teamById.get(teamId)?.short_name) || 'TBD'
  const label = (g: Game) => {
    const when = g.status === 'live' || g.status === 'halftime' ? 'Live' : g.status === 'final' ? 'Final' : g.week ? `Week ${g.week}` : 'Game'
    return `${when} · ${short(g.home_team_id)} vs ${short(g.away_team_id)}${g.kind === 'playoff' ? ' · Championship' : ''}`
  }

  const picker = (
    <label className="relative flex min-w-0 flex-1 items-center">
      <span className="sr-only">Which game</span>
      <select
        value={id}
        onChange={(e) => setChosen(e.target.value)}
        className="pressable min-h-(--tap-min) w-full min-w-0 appearance-none truncate rounded-pill bg-transparent pr-(--tap-min) font-display text-title font-bold uppercase text-text"
      >
        {games.map((g) => (
          <option key={g.id} value={g.id}>{label(g)}</option>
        ))}
      </select>
      <Icon name="caret-down" size="xs" className="pointer-events-none absolute right-2 text-text-2" />
    </label>
  )

  return <GameScreen key={id} id={id} embedded picker={picker} />
}
