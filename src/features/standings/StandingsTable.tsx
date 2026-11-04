import { Fragment, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import type { StandingRow, Team } from '../../types/db'
import { Icon } from '../../ui/Icon'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { houseSpring } from '../../ui/motion/spring'

interface Props {
  rows: StandingRow[]
  teamById: Map<string, Team>
  streakOf: Map<string, string>
  highlightTeamId?: string
  /** Team rows open the Team tab. Off for past seasons, whose teams the Team tab no longer shows. */
  linkTeams?: boolean
}

const COLS = [
  { key: 'W', label: 'Wins' },
  { key: 'L', label: 'Losses' },
  { key: 'T', label: 'Ties' },
  { key: 'PF', label: 'Points for' },
  { key: 'PA', label: 'Points against' },
  { key: 'Strk', label: 'Streak' },
] as const

/**
 * ESPN-style table: W, L, PF, PA and streak. A gold line under 2nd place marks who plays in the final.
 * Tap a team to open it on the Team tab.
 */
export function StandingsTable({ rows, teamById, streakOf, highlightTeamId, linkTeams = true }: Props) {
  // A T column only when someone has tied.
  const cols = rows.some((r) => r.ties > 0) ? COLS : COLS.filter((c) => c.key !== 'T')
  const anyPlayed = rows.some((r) => r.games_played > 0)
  const ordered = [...rows].sort((a, b) => a.rank - b.rank || b.point_diff - a.point_diff || b.points_for - a.points_for)
  return (
    <div className="glass-list overflow-hidden rounded-panel">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Standings</caption>
        <thead>
          <tr className="caps-label">
            <th scope="col" className="w-6 py-2 pl-3 pr-2 text-center font-strong">
              <span className="sr-only">Rank</span>#
            </th>
            <th scope="col" className="py-2 font-strong">
              Team
            </th>
            {cols.map((c) => (
              <th key={c.key} scope="col" className="py-2 pr-3 text-right font-strong whitespace-nowrap">
                <abbr title={c.label} className="no-underline">
                  {c.key}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((r, idx) => {
            const team = teamById.get(r.team_id)
            // Before the first final everyone is tied at 0-0: no ranks, no crown yet.
            const played = r.games_played > 0
            const first = played && r.rank === 1
            const mine = r.team_id === highlightTeamId
            const name = (
              <>
                <TeamBadge team={team} size="sm" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-display font-bold uppercase text-text">{team?.short_name ?? 'TBD'}</span>
                  {mine && <span className="caps-label text-accent">You</span>}
                </span>
              </>
            )
            const streak = streakOf.get(r.team_id) ?? '–'
            const value = {
              W: r.wins,
              L: r.losses,
              T: r.ties,
              PF: r.points_for,
              PA: r.points_against,
            }
            return (
              <Fragment key={r.team_id}>
                <motion.tr
                  layout
                  transition={houseSpring()}
                  style={
                    {
                      ...teamStyle(team?.color_key),
                      '--i': Math.min(idx, 8),
                    } as CSSProperties
                  }
                  className={`rise border-t border-divider ${first || mine ? 'surface-accent' : ''}`}
                >
                  <td className="w-6 py-2.5 pl-3 pr-2 text-center">
                    {first ? (
                      <span className="flex flex-col items-center gap-0.5">
                        <Icon name="crown" size="xs" className="text-gold" />
                        <span className="numeral text-title text-gold nums">{r.rank}</span>
                      </span>
                    ) : (
                      <span className="numeral text-title text-text-3 nums">{played ? r.rank : '–'}</span>
                    )}
                  </td>
                  <th scope="row" className="w-full max-w-0 py-1 pr-2 font-normal">
                    {linkTeams ? (
                      <Link
                        to={`/team?team=${r.team_id}`}
                        aria-label={`${team?.name ?? 'Team'}: open on the Team tab`}
                        className="pressable flex min-h-(--tap-min) min-w-0 items-center gap-2"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="flex min-h-(--tap-min) min-w-0 items-center gap-2">{name}</span>
                    )}
                  </th>
                  {cols
                    .filter((c) => c.key !== 'Strk')
                    .map((c) => (
                      <td
                        key={c.key}
                        className={`nums py-2.5 pr-3 text-right whitespace-nowrap ${c.key === 'PF' || c.key === 'PA' ? 'text-small text-text-2-strong' : 'font-strong text-text'}`}
                      >
                        {value[c.key as keyof typeof value]}
                      </td>
                    ))}
                  <td
                    className={`nums py-2.5 pr-3 text-right text-small font-strong whitespace-nowrap ${streak.startsWith('W') ? 'text-ok' : streak.startsWith('L') ? 'text-danger' : 'text-text-2-strong'}`}
                  >
                    {streak}
                  </td>
                </motion.tr>
                {idx === 1 && ordered.length > 2 && anyPlayed && (
                  <tr aria-hidden="true">
                    <td colSpan={cols.length + 2} className="border-t-2 border-dashed border-gold px-3 py-1 text-center caps-label text-gold">
                      Top two play in the final
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
