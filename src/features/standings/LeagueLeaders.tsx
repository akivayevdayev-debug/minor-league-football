import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { currentTeams, displayName, usePlayers, useRosters, useStatTotals, useTeams } from '../league'
import { rankPlayers } from './rank'
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

/**
 * League leaders: one tile per stat, scrolled sideways. Each tile shows the career leader.
 * Tapping a tile ranks everyone in that stat below, with how far each player is behind the leader.
 */
export function LeagueLeaders() {
  const totals = useStatTotals()
  const players = usePlayers()
  const rosters = useRosters()
  const teams = useTeams()

  const [picked, setPicked] = useState<StatTypeId>('td')
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

  const ranking = useMemo(
    () => rankPlayers(players.data ?? [], totals.data, picked),
    [players.data, totals.data, picked],
  )
  const pickedLabel = STATS.find((s) => s.value === picked)?.label ?? ''

  if (totals.isPending || players.isPending) return <Skeleton rows={2} />
  if (totals.isError || players.isError) return <ErrorState what="the leaders" onRetry={() => void (totals.refetch(), players.refetch())} />

  return (
    <section aria-labelledby="league-leaders" className="flex flex-col gap-3">
      <h2 id="league-leaders" className="text-body-lg">League leaders</h2>
      <ul className="no-scrollbar -mx-4 -my-2 flex snap-x gap-2 overflow-x-auto px-4 py-2">
        {leaders.map(({ stat, player, team, value }, i) => {
          const body = (
            <>
              <span className="caps-label">{stat.label}</span>
              {player ? (
                <span className="flex items-center gap-2">
                  <PlayerBadge jersey={player.jersey} team={team?.color_key} photo={player.photo_path} size="sm" />
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
              <button
                type="button"
                aria-pressed={picked === stat.value}
                onClick={() => setPicked(stat.value)}
                style={teamStyle(team?.color_key)}
                className="lit pressable lift glass-subtle flex w-40 flex-col gap-2 rounded-panel border-2 p-3 text-left aria-pressed:border-gold"
              >
                {body}
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col gap-2">
        <h3 className="caps-label">{pickedLabel} ranking</h3>
        {ranking.length === 0 ? (
          <p className="glass-list rounded-panel px-3 py-4 text-small text-text-2">No {pickedLabel.toLowerCase()} yet.</p>
        ) : (
          <ol className="glass-list divide-y divide-(--glass-groove) overflow-hidden rounded-panel">
            {ranking.map((r, i) => {
              const team = teamOf.get(r.player.id)
              const leader = ranking[0]!.value
              const next = ranking[i + 1]
              // The leader shows their lead over the next number down; everyone else, how far behind the leader.
              const gap = r.rank === 1 ? (next ? `+${r.value - next.value}` : null) : `−${leader - r.value}`
              return (
                <li key={r.player.id}>
                  <Link
                    to={`/players/${r.player.id}`}
                    style={teamStyle(team?.color_key)}
                    className="pressable flex items-center gap-3 px-3 py-2"
                  >
                    <span className={`numeral w-6 text-center text-body-lg nums ${r.rank === 1 ? 'text-gold' : 'text-text-2'}`}>{r.rank}</span>
                    <PlayerBadge jersey={r.player.jersey} team={team?.color_key} photo={r.player.photo_path} size="sm" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-small font-strong">{displayName(r.player)}</span>
                      <span className="truncate text-label text-text-2">{team?.name ?? (r.player.is_guest ? 'Guest' : 'No team')}</span>
                    </span>
                    {gap && <span className={`text-label nums ${r.rank === 1 ? 'text-gold' : 'text-text-2'}`}>{gap}</span>}
                    <span className="numeral w-8 text-right text-stat nums">{r.value}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
