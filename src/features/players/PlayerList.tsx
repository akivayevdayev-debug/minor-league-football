import { useDeferredValue, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { currentTeams, displayName, usePlayers, useRosters, useStatTotals, useTeams } from '../league'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { AddGuestSheet } from './AddGuestSheet'

export function PlayerList() {
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()
  const totals = useStatTotals()
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

  if (players.isPending) return <Skeleton rows={6} />
  if (players.isError) return <ErrorState what="players" onRetry={() => players.refetch()} />

  return (
    <div className="flex flex-col gap-4">
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
        <ul className="glass-panel flex flex-col overflow-hidden rounded-panel">
          {shown.map((p, i) => {
            const team = teamOf.get(p.id)
            const t = totals.data?.get(p.id)
            return (
              <li key={p.id} className="rise border-t border-divider first:border-t-0" style={{ '--i': Math.min(i, 10) } as CSSProperties}>
                <Link to={`/players/${p.id}`} className="lit flex min-h-(--tap-game) items-center gap-3 px-4 py-3 hover-fine:bg-(--row-hover)">
                  <PlayerBadge jersey={p.jersey} team={team?.color_key} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-strong">{displayName(p)}</span>
                    <span className="truncate text-small text-text-2">
                      {team?.name ?? (p.is_guest ? 'Guest' : 'No team')}
                      {p.positions.length > 0 && ` · ${p.positions.join(', ')}`}
                    </span>
                  </span>
                  {p.is_guest ? (
                    <Badge variant="muted">Guest</Badge>
                  ) : (
                    t?.td !== undefined && (
                      <span className="flex flex-col items-end">
                        <span className="numeral text-title">{t.td}</span>
                        <span className="caps-label">TD</span>
                      </span>
                    )
                  )}
                  <Icon name="chevron" size="xs" className="text-text-3" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <AddGuestSheet open={adding} onOpenChange={setAdding} />
    </div>
  )
}
