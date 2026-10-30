import type { StandingRow, Team } from '../../types/db'
import { TeamBadge } from '../../ui/TeamBadge'
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

/** The table. First place is lit cyan; your team gets a cyan stripe. */
export function StandingsTable({ rows, teamById, highlightTeamId, view = 'record', compact = false }: Props) {
  const shown = compact ? rows.slice(0, 3) : rows
  const cols = view === 'record' ? ['W-L', 'Pct', 'GP'] : ['PF', 'PA', 'Diff']
  return (
    <div className="glass-panel overflow-hidden rounded-panel">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{view === 'record' ? 'Standings by record' : 'Standings by points'}</caption>
        <thead>
          <tr className="caps-label">
            <th scope="col" className="w-10 py-3 pl-4 font-strong">#</th>
            <th scope="col" className="py-3 font-strong">Team</th>
            {cols.map((c) => (
              <th key={c} scope="col" className="py-3 pr-4 text-right font-strong whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const team = teamById.get(r.team_id)
            const first = r.rank === 1
            const mine = r.team_id === highlightTeamId
            const values =
              view === 'record'
                ? [recordText(r), pct(r.win_pct), r.games_played]
                : [r.points_for, r.points_against, r.point_diff > 0 ? `+${r.point_diff}` : r.point_diff]
            return (
              <tr key={r.team_id} className={`border-t border-divider ${first ? 'surface-accent' : mine ? 'bg-(--row-hover)' : ''}`}>
                <td className={`numeral py-3 pl-4 text-title ${first ? 'text-accent text-glow' : 'text-text-3'}`}>{r.rank}</td>
                <th scope="row" className="w-full max-w-0 py-3 pr-3 font-normal">
                  <span className="flex min-w-0 items-center gap-3">
                    <TeamBadge team={team} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-strong text-text">{team?.name ?? 'Unknown team'}</span>
                      {mine && <span className="caps-label text-accent">Your team</span>}
                    </span>
                  </span>
                </th>
                {values.map((v, i) => (
                  <td key={i} className={`nums py-3 pr-4 text-right whitespace-nowrap ${i === 0 ? 'font-strong text-text' : 'text-text-2-strong'}`}>{v}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
