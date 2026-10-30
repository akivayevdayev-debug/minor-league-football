import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { displayName, recordText, useCurrentSeason, usePlayers, useRosters, useStandings, useTeams } from '../league'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { MovePlayerSheet } from './MovePlayerSheet'

/** Each team's current roster, with past players kept as history. */
export function TeamsPanel() {
  const teams = useTeams()
  const rosters = useRosters()
  const players = usePlayers()
  const season = useCurrentSeason()
  const standings = useStandings(season.data?.id)
  const [moving, setMoving] = useState(false)

  const playerById = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data])
  const rowByTeam = useMemo(() => new Map((standings.data ?? []).map((r) => [r.team_id, r])), [standings.data])

  if (teams.isPending || rosters.isPending) return <Skeleton rows={3} />
  if (teams.isError || rosters.isError) return <ErrorState what="teams" onRetry={() => void (teams.refetch(), rosters.refetch())} />
  if (teams.data.length === 0) return <EmptyState icon="players" title="No teams yet" body="Teams appear here once the roster is imported." />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setMoving(true)}>
          <Icon name="history" size="xs" />
          Move a player
        </Button>
      </div>

      {teams.data.map((team, i) => {
        const lines = rosters.data.filter((r) => r.team_id === team.id)
        const now = lines.filter((r) => r.ends_on === null)
        const past = lines.filter((r) => r.ends_on !== null)
        const row = rowByTeam.get(team.id)
        return (
          <section
            key={team.id}
            style={{ ...teamStyle(team.color_key), '--i': Math.min(i, 8) } as CSSProperties}
            className="rise glass-panel flex flex-col gap-3 rounded-panel p-3"
          >
            <header className="flex items-center gap-3">
              <TeamBadge team={team} size="md" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 className="truncate text-body-lg leading-tight">{team.name}</h2>
                <p className="caps-label">{now.length} on the roster</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="numeral text-title">{row ? recordText(row) : '–'}</span>
                <span className="caps-label">Record</span>
              </div>
            </header>
            {now.length === 0 ? (
              <p className="text-small text-text-2">No players on this team right now.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {now.map((r) => {
                  const p = playerById.get(r.player_id)
                  return (
                    p && (
                      <li key={r.id}>
                        <Link
                          to={`/players/${p.id}`}
                          className="pressable lit flex min-h-(--tap-min) items-center gap-3 rounded-control px-2 py-1 hover-fine:bg-(--row-hover)"
                        >
                          <PlayerBadge jersey={p.jersey} team={team.color_key} photo={p.photo_path} size="sm" />
                          <span className="truncate font-medium">{displayName(p)}</span>
                        </Link>
                      </li>
                    )
                  )
                })}
              </ul>
            )}
            {past.length > 0 && (
              <details className="text-text-2">
                <summary className="flex min-h-(--tap-min) cursor-pointer items-center caps-label hover-fine:text-text">
                  Past players ({past.length})
                </summary>
                <ul className="flex flex-col gap-1 pb-1">
                  {past.map((r) => {
                    const p = playerById.get(r.player_id)
                    return (
                      <li key={r.id} className="nums flex justify-between gap-3 text-small">
                        <span className="truncate">{p ? displayName(p) : 'Unknown player'}</span>
                        <span>left {r.ends_on}</span>
                      </li>
                    )
                  })}
                </ul>
              </details>
            )}
          </section>
        )
      })}

      <MovePlayerSheet open={moving} onOpenChange={setMoving} />
    </div>
  )
}
