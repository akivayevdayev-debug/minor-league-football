import { useMemo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { currentTeams, displayName, usePlayers, useRosters, useStatTotals, useTeams } from '../league'
import type { Player, StatTypeId, Team } from '../../types/db'
import { ErrorState } from '../../ui/ErrorState'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Skeleton } from '../../ui/Skeleton'
import { teamStyle } from '../../ui/team'
import { CountUp } from '../../ui/motion'

const STATS = [
  { value: 'td', label: 'Touchdowns' },
  { value: 'rec', label: 'Catches' },
  { value: 'int', label: 'Picks' },
] as const satisfies readonly { value: StatTypeId; label: string }[]

interface Leader {
  stat: (typeof STATS)[number]
  player: Player | null
  team: Team | undefined
  value: number
}

/** League leaders: one tile per stat, scrolled sideways. Each tile shows the career leader; tapping opens their profile. */
export function LeagueLeaders() {
  const totals = useStatTotals()
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()

  const teamOf = useMemo(() => currentTeams(rosters.data ?? [], teams.data ?? []), [rosters.data, teams.data])
  const leaders = useMemo<Leader[]>(
    () =>
      STATS.map((stat) => {
        const best = (players.data ?? [])
          .map((p) => ({ p, n: totals.data?.get(p.id)?.[stat.value] ?? 0 }))
          .filter((r) => r.n > 0)
          .sort((a, b) => b.n - a.n)[0]
        const team = best ? teamOf.get(best.p.id) : undefined
        return { stat, player: best?.p ?? null, team, value: best?.n ?? 0 }
      }),
    [players.data, totals.data, teamOf],
  )

  if (totals.isPending || players.isPending) return <Skeleton rows={2} />
  if (totals.isError || players.isError) return <ErrorState what="the leaders" onRetry={() => void (totals.refetch(), players.refetch())} />

  return (
    <section aria-labelledby="league-leaders" className="flex flex-col gap-3">
      <h2 id="league-leaders" className="text-body-lg">League leaders</h2>
      <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
        {leaders.map(({ stat, player, team, value }, i) => {
          const body = (
            <>
              <span className="caps-label">{stat.label}</span>
              {player ? (
                <span className="flex items-center gap-2">
                  <PlayerBadge jersey={player.jersey} team={team?.color_key} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-small font-strong">{displayName(player)}</span>
                    <span className="truncate text-label text-text-2">{team?.name ?? (player.is_guest ? 'Guest' : 'No team')}</span>
                  </span>
                </span>
              ) : (
                <span className="text-small text-text-2">None yet</span>
              )}
              <span className="numeral text-stat text-gold nums">{player ? <CountUp value={value} /> : '–'}</span>
            </>
          )
          return (
            <li key={stat.value} className="rise snap-start" style={{ '--i': Math.min(i, 8) } as CSSProperties}>
              {player ? (
                <Link
                  to={`/players/${player.id}`}
                  style={teamStyle(team?.color_key)}
                  className="lit pressable lift glass-subtle flex w-40 flex-col gap-2 rounded-panel p-3"
                >
                  {body}
                </Link>
              ) : (
                <div className="glass-subtle flex w-40 flex-col gap-2 rounded-panel p-3">{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
