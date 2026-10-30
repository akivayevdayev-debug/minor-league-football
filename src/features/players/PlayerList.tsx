import { useDeferredValue, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { currentTeams, displayName, usePlayerProjections, usePlayers, useRosters, useTeams } from '../league'
import { Input } from '@/components/ui/input'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { AddGuestSheet } from './AddGuestSheet'

/** Players grouped by team: a glowing team header, then slim rows (jersey, name, positions, estimate per game). */
export function PlayerList() {
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()
  const projections = usePlayerProjections()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const query = useDeferredValue(search.trim().toLowerCase())

  const teamOf = useMemo(() => currentTeams(rosters.data ?? [], teams.data ?? []), [rosters.data, teams.data])
  const shown = useMemo(
    () =>
      (players.data ?? []).filter(
        (p) => !query || p.full_name.toLowerCase().includes(query) || p.nickname?.toLowerCase().includes(query),
      ),
    [players.data, query],
  )
  // One box per team (in team order), then players with no team.
  const groups = useMemo(() => {
    const out = (teams.data ?? []).map((t) => ({ key: t.id, team: t as typeof t | undefined, label: t.name, list: shown.filter((p) => teamOf.get(p.id)?.id === t.id) }))
    out.push({ key: 'none', team: undefined, label: 'No team', list: shown.filter((p) => !teamOf.get(p.id)) })
    return out.filter((g) => g.list.length > 0)
  }, [teams.data, shown, teamOf])

  if (players.isPending) return <Skeleton rows={6} />
  if (players.isError) return <ErrorState what="players" onRetry={() => players.refetch()} />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search players</span>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-2">
            <Icon name="search" size="sm" />
          </span>
          <Input type="search" placeholder="Search players" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </label>
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Icon name="add-guest" size="sm" />
          <span className="max-sm:sr-only">Add guest</span>
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon="players"
          title={query ? 'No one by that name' : 'No players yet'}
          body={query ? 'Check the spelling or clear the search.' : 'Players appear here once the roster is imported.'}
        />
      ) : (
        groups.map(({ key, team, label, list }, gi) => (
          <section
            key={key}
            aria-label={label}
            style={{ ...teamStyle(team?.color_key), '--i': Math.min(gi, 8) } as CSSProperties}
            className="rise glass-list team-glow overflow-hidden rounded-panel"
          >
            <header className="surface-accent flex items-center gap-2 px-3 py-2">
              {team ? <TeamBadge team={team} size="sm" /> : <Icon name="players" size="sm" className="text-text-2" />}
              <h2 className="flex-1 truncate font-display text-body font-bold uppercase text-(--team-light,var(--text))">{label}</h2>
              <span className="caps-label nums">{list.length}</span>
            </header>
            <ul className="divide-y divide-divider">
              {list.map((p) => {
                const proj = projections.data?.get(p.id)
                return (
                  <li key={p.id}>
                    <Link
                      to={`/players/${p.id}`}
                      className="pressable lit flex min-h-(--tap-min) items-center gap-3 px-3 py-2 hover-fine:bg-(--row-hover)"
                    >
                      <PlayerBadge jersey={p.jersey} team={team?.color_key} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate font-strong">{displayName(p)}</span>
                        <span className="truncate caps-label">{p.positions.length > 0 ? p.positions.join(' · ') : p.is_guest ? 'Guest' : 'No position yet'}</span>
                      </span>
                      {proj && (
                        <span className="flex shrink-0 flex-col items-end leading-tight">
                          <span className="numeral text-body-lg">{proj.points_per_game.toFixed(1)}</span>
                          <span className="caps-label">est/gm</span>
                        </span>
                      )}
                      <Icon name="chevron" size="xs" className="shrink-0 text-text-3" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}

      <AddGuestSheet open={adding} onOpenChange={setAdding} />
    </div>
  )
}
