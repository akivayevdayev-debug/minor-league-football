import type { CSSProperties } from 'react'
import type { StandingRow, Team } from '../../types/db'
import { Icon } from '../../ui/Icon'
import { TeamBadge } from '../../ui/TeamBadge'
import { teamStyle } from '../../ui/team'
import { recordText } from '../league'

interface Props {
  rows: StandingRow[]
  teamById: Map<string, Team>
  highlightTeamId?: string
  /** Points view shows PF / PA / diff instead of W-L / win %. */
  view?: 'record' | 'points'
  compact?: boolean
}

const pct = (n: number | null) => (n === null ? '–' : Number(n).toFixed(3).replace(/^0/, ''))

/** Compact ESPN-style table in one glass panel. Rank 1 gets a gold numeral, a crown and a team-tinted row. */
export function StandingsTable({ rows, teamById, highlightTeamId, view = 'record', compact = false }: Props) {
  const shown = compact ? rows.slice(0, 3) : rows
  const cols = view === 'record' ? ['W-L', 'Pct', 'GP'] : ['PF', 'PA', 'Diff']
  return (
    <div className="glass-panel overflow-hidden rounded-panel">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{view === 'record' ? 'Standings by record' : 'Standings by points'}</caption>
        <thead>
          <tr className="caps-label">
            <th scope="col" className="w-6 py-2 pl-3 pr-3 text-center font-strong"><span className="sr-only">Rank</span>#</th>
            <th scope="col" className="py-2 font-strong">Team</th>
            {cols.map((c) => (
              <th key={c} scope="col" className="py-2 pr-3 text-right font-strong whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, idx) => {
            const team = teamById.get(r.team_id)
            const first = r.rank === 1
            const mine = r.team_id === highlightTeamId
            const values =
              view === 'record'
                ? [recordText(r), pct(r.win_pct), r.games_played]
                : [r.points_for, r.points_against, r.point_diff > 0 ? `+${r.point_diff}` : r.point_diff]
            return (
              <tr
                key={r.team_id}
                style={{ ...teamStyle(team?.color_key), '--i': Math.min(idx, 8) } as CSSProperties}
                className={`rise border-t border-divider ${first ? 'surface-accent' : mine ? 'bg-(--row-hover)' : ''}`}
              >
                <td className="w-6 py-2.5 pl-3 pr-3 text-center">
                  {first ? (
                    <span className="flex flex-col items-center gap-0.5">
                      <Icon name="crown" size="xs" className="text-gold" />
                      <span className="numeral text-title text-gold nums">{r.rank}</span>
                    </span>
                  ) : (
                    <span className="numeral text-title text-text-3 nums">{r.rank}</span>
                  )}
                </td>
                <th scope="row" className="w-full max-w-0 py-2.5 pr-3 font-normal">
                  <span className="flex min-w-0 items-center gap-3">
                    <TeamBadge team={team} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-strong text-(--team-light)">{team?.name ?? 'Unknown team'}</span>
                      {mine && <span className="caps-label text-accent">Your team</span>}
                    </span>
                  </span>
                </th>
                {values.map((v, i) => {
                  const diffTone = view === 'points' && i === 2 ? (r.point_diff > 0 ? 'text-ok' : r.point_diff < 0 ? 'text-danger' : 'text-text-2-strong') : ''
                  const strong = i === 0 && view === 'record' ? 'font-strong text-text' : 'text-text-2-strong'
                  return (
                    <td key={i} className={`nums py-2.5 pr-3 text-right text-small whitespace-nowrap ${diffTone || strong}`}>{v}</td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
