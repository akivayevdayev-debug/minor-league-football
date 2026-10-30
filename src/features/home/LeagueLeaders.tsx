import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { currentTeams, displayName, usePlayers, useRosters, useStatTotals, useTeams } from '../league'
import type { StatTypeId } from '../../types/db'
import { ErrorState } from '../../ui/ErrorState'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { CountUp, Segmented, SegmentedPanel } from '../../ui/motion'

const STATS = [
  { value: 'td', label: 'TDs' },
  { value: 'rec', label: 'Catches' },
  { value: 'int', label: 'Picks' },
] as const satisfies readonly { value: StatTypeId; label: string }[]

type Stat = (typeof STATS)[number]['value']

/** Top three players for a stat, career totals. */
export function LeagueLeaders() {
  const totals = useStatTotals()
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()
  const [stat, setStat] = useState<Stat>('td')

  const teamOf = useMemo(() => currentTeams(rosters.data ?? [], teams.data ?? []), [rosters.data, teams.data])
  const top = useMemo(() => {
    const list = (players.data ?? [])
      .map((p) => ({ p, n: totals.data?.get(p.id)?.[stat] ?? 0 }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n)
    return list.slice(0, 3)
  }, [players.data, totals.data, stat])

  if (totals.isPending || players.isPending) return <Skeleton rows={3} />
  if (totals.isError || players.isError) return <ErrorState what="the leaders" onRetry={() => void (totals.refetch(), players.refetch())} />

  return (
    <Segmented label="Stat" value={stat} onChange={setStat} options={STATS}>
      {STATS.map((s) => (
        <SegmentedPanel key={s.value} value={s.value}>
          {top.length === 0 ? (
            <p className="surface-inset rounded-panel p-4 text-text-2">No {s.value === 'td' ? 'touchdowns' : s.label.toLowerCase()} recorded yet.</p>
          ) : (
            <ol className="glass-panel flex flex-col overflow-hidden rounded-panel">
              {top.map(({ p, n }, i) => {
                const team = teamOf.get(p.id)
                return (
                  <li key={p.id} className={i === 0 ? 'surface-accent' : 'border-t border-divider'}>
                    <Link to={`/players/${p.id}`} className="lit flex min-h-(--tap-game) items-center gap-3 px-4 py-3 hover-fine:bg-(--row-hover)">
                      <span className={`numeral w-6 text-title ${i === 0 ? 'text-accent' : 'text-text-3'}`}>{i + 1}</span>
                      <PlayerBadge jersey={p.jersey} team={team?.color_key} size="sm" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-strong">{displayName(p)}</span>
                        <span className="truncate text-small text-text-2">{team?.name ?? (p.is_guest ? 'Guest' : 'No team')}</span>
                      </span>
                      <span className={`numeral text-stat ${i === 0 ? 'text-accent text-glow' : 'text-text'}`}>
                        <CountUp value={n} />
                      </span>
                      <Icon name="chevron" size="xs" className="text-text-3" />
                    </Link>
                  </li>
                )
              })}
            </ol>
          )}
        </SegmentedPanel>
      ))}
    </Segmented>
  )
}
