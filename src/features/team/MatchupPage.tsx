import { useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { currentTeams, displayName, useGameScores, useGames, usePlayers, useRosters, useTeams } from '../league'
import { useGame, useLiveGame } from '../game/api'
import { formatGameTime, ZONE_LABEL } from '../../lib/time'
import type { Player, Team } from '../../types/db'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { PointsSheet } from './WeekRows'
import { useGameWeek } from './useTeamWeek'
import { fmtPoints, pairByPosition, type WeekRow } from './week'

/**
 * Matchup: both teams side by side with projected and actual totals pinned on top, and players
 * facing each other by position (QB vs QB, WR vs WR). No win percentage: projected totals only.
 */
export default function MatchupPage() {
  const { id } = useParams()
  // The game is loaded on its own, so a link to any season's game works.
  const gameQuery = useGame(id)
  const game = gameQuery.data ?? null
  const seasonId = game?.season_id
  const games = useGames(seasonId)
  const teams = useTeams()
  const players = usePlayers()
  const rosters = useRosters()
  const scores = useGameScores(seasonId)
  const [pointsFor, setPointsFor] = useState<WeekRow | null>(null)

  const live = game?.status === 'live' || game?.status === 'halftime'
  useLiveGame(live ? game.id : undefined, null, false)

  const seasonTeams = useMemo(() => (teams.data ?? []).filter((t) => t.season_id === seasonId), [teams.data, seasonId])
  const teamById = useMemo(() => new Map(seasonTeams.map((t) => [t.id, t])), [seasonTeams])
  const teamOf = useMemo(() => currentTeams(rosters.data ?? [], seasonTeams), [rosters.data, seasonTeams])
  const playerById = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data])
  const gw = useGameWeek({ game, seasonId, games: games.data ?? [], players: players.data ?? [], teamOf })

  if (gameQuery.isPending || teams.isPending || players.isPending || rosters.isPending) return <Skeleton rows={6} />
  if (gameQuery.isError || teams.isError || players.isError || rosters.isError) {
    return <ErrorState what="the matchup" onRetry={() => void (gameQuery.refetch(), teams.refetch(), players.refetch(), rosters.refetch())} />
  }
  if (!game || !game.home_team_id || !game.away_team_id) {
    return <EmptyState icon="schedule" title="Game not found" body="It may have been removed. Pick a game from the Team tab or the schedule." />
  }

  const home = teamById.get(game.home_team_id)
  const away = teamById.get(game.away_team_id)
  const left = gw.side(game.home_team_id)
  const right = gw.side(game.away_team_id)
  const pairs = pairByPosition(left.rows, right.rows)
  const score = scores.data?.get(game.id)
  const started = game.status !== 'scheduled'

  return (
    <div className="flex flex-col gap-4">
      {/* Totals stay pinned under the app header while the player rows scroll. */}
      <header className="rise glass-hero sticky top-[calc(var(--header-top)+var(--header-height))] z-(--z-raised) flex flex-col gap-2 rounded-panel p-3">
        <div className="flex items-center gap-2">
          <span className="caps-label">Matchup{game.week !== null ? ` · Week ${game.week}` : ''}</span>
          <span className="flex-1" />
          {live ? (
            <Badge variant="live">{game.status === 'live' ? 'Live' : 'Half'}</Badge>
          ) : game.status === 'final' ? (
            <span className="caps-label">Final{score ? ` · ${score.home_points}–${score.away_points}` : ''}</span>
          ) : (
            <span className="caps-label nums">{game.starts_at ? `${formatGameTime(game.starts_at)} ${ZONE_LABEL}` : 'Time not set'}</span>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <TeamTotal team={home} projected={left.projected} actual={left.actual} />
          <span className="caps-label text-center">
            {live && score ? (
              <span className="numeral text-body-lg nums text-text-2">
                {score.home_points}–{score.away_points}
              </span>
            ) : (
              'vs'
            )}
          </span>
          <TeamTotal team={away} projected={right.projected} actual={right.actual} alignEnd />
        </div>
        <p className="caps-label text-center">{started ? 'Stat points · projected under each' : 'Projected stat points'}</p>
      </header>

      <ul className="rise glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel" style={{ '--i': 1 } as CSSProperties}>
        {pairs.map(([h, a], i) => (
          <li key={`${h?.playerId ?? '-'}-${a?.playerId ?? '-'}-${i}`} className="grid grid-cols-[1fr_auto_1fr] items-stretch">
            <Side row={h} player={h ? playerById.get(h.playerId) : undefined} team={home} onPoints={setPointsFor} />
            <span className="flex w-10 items-center justify-center caps-label text-text-3">{h && a && h.position !== a.position ? '·' : (h?.position ?? a?.position)}</span>
            <Side row={a} player={a ? playerById.get(a.playerId) : undefined} team={away} onPoints={setPointsFor} alignEnd />
          </li>
        ))}
      </ul>

      <PointsSheet
        row={pointsFor ? ([...left.rows, ...right.rows].find((r) => r.playerId === pointsFor.playerId) ?? pointsFor) : null}
        player={pointsFor ? playerById.get(pointsFor.playerId) : undefined}
        statPoints={gw.statPoints}
        onClose={() => setPointsFor(null)}
      />
    </div>
  )
}

function TeamTotal({ team, projected, actual, alignEnd }: { team: Team | undefined; projected: number; actual: number | null; alignEnd?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${alignEnd ? 'items-end text-right' : 'items-start'}`} style={teamStyle(team?.color_key)}>
      <span className={`flex min-w-0 items-center gap-2 ${alignEnd ? 'flex-row-reverse' : ''}`}>
        <TeamBadge team={team} size="sm" />
        <span className="truncate font-display font-bold uppercase">{team?.short_name ?? 'TBD'}</span>
      </span>
      <span className="numeral text-title nums">{actual !== null ? fmtPoints(actual) : projected > 0 ? projected.toFixed(1) : '—'}</span>
      {actual !== null && <span className="caps-label nums">proj {projected.toFixed(1)}</span>}
    </div>
  )
}

function Side({
  row,
  player,
  team,
  onPoints,
  alignEnd,
}: {
  row: WeekRow | null
  player: Player | undefined
  team: Team | undefined
  onPoints(row: WeekRow): void
  alignEnd?: boolean
}) {
  if (!row) return <span className="min-h-(--tap-min)" />
  const name = player ? displayName(player) : 'Unknown player'
  const pts = row.actual !== null ? fmtPoints(row.actual) : row.projected !== null ? row.projected.toFixed(1) : '—'
  return (
    <button
      type="button"
      onClick={() => onPoints(row)}
      aria-label={`${name}, ${row.position}: ${row.actual !== null ? `${pts} points` : `estimate ${pts}`}`}
      className={`pressable lit flex min-h-(--tap-min) min-w-0 items-center gap-2 bg-transparent px-2 py-2 hover-fine:bg-(--row-hover) ${alignEnd ? 'flex-row-reverse text-right' : 'text-left'}`}
    >
      <PlayerBadge jersey={player?.jersey ?? null} team={row.isQb ? undefined : team?.color_key} photo={player?.photo_path ?? null} size="sm" />
      <span className={`flex min-w-0 flex-1 flex-col leading-tight ${alignEnd ? 'items-end' : 'items-start'}`}>
        <span className="w-full truncate font-strong">{name}</span>
        <span className={`numeral text-body-lg nums ${row.actual === null ? 'text-text-2-strong' : ''}`}>{pts}</span>
      </span>
    </button>
  )
}
