import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { displayName, usePlayers, useRosters, useTeams } from '../league'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamVar } from '../../ui/team'
import { MovePlayerSheet } from './MovePlayerSheet'

/** Each team's current roster, with past players kept as history. */
export function TeamsPanel() {
  const teams = useTeams()
  const rosters = useRosters()
  const players = usePlayers()
  const [moving, setMoving] = useState(false)

  const playerById = useMemo(() => new Map((players.data ?? []).map((p) => [p.id, p])), [players.data])

  if (teams.isPending || rosters.isPending) return <Skeleton rows={3} />
  if (teams.isError || rosters.isError) return <ErrorState what="teams" onRetry={() => void (teams.refetch(), rosters.refetch())} />
  if (teams.data.length === 0) return <EmptyState icon="players" title="No teams yet" body="Teams appear here once the roster is imported." />

  return (
    <div className="flex flex-col gap-4">
      <Button variant="outline" onClick={() => setMoving(true)} className="self-start">
        <Icon name="history" size="sm" />
        Move a player
      </Button>

      {teams.data.map((team, i) => {
        const lines = rosters.data.filter((r) => r.team_id === team.id)
        const now = lines.filter((r) => r.ends_on === null)
        const past = lines.filter((r) => r.ends_on !== null)
        return (
          <section
            key={team.id}
            style={{ '--team': teamVar(team.color_key), '--i': i } as CSSProperties}
            className="rise glass-panel team-wash flex flex-col gap-4 rounded-panel p-4"
          >
            <header className="flex items-center gap-3">
              <TeamBadge team={team} size="md" />
              <div className="flex flex-col">
                <h2 className="text-title leading-none">{team.name}</h2>
                <p className="caps-label">{now.length} on the roster</p>
              </div>
            </header>
            {now.length === 0 ? (
              <p className="text-text-2">No players on this team right now.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {now.map((r) => {
                  const p = playerById.get(r.player_id)
                  return (
                    p && (
                      <li key={r.id}>
                        <Link to={`/players/${p.id}`} className="lit flex min-h-(--tap-min) items-center gap-3 rounded-control px-2 py-1 hover-fine:bg-(--row-hover)">
                          <PlayerBadge jersey={p.jersey} team={team.color_key} size="sm" />
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
                      <li key={r.id} className="nums flex justify-between gap-3">
                        <span className="truncate">{p ? displayName(p) : 'Unknown player'}</span>
                        <span className="text-small">left {r.ends_on}</span>
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
