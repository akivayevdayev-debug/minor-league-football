import { displayName } from '../league'
import type { Player } from '../../types/db'
import { Icon } from '../../ui/Icon'
import { Sheet } from '../../ui/Sheet'
import type { StatInfo } from './useTeamWeek'
import { fmtPoints, type WeekRow } from './week'

/** How a player's points were scored in the game: each stat, its count and its points. */
export function PointsSheet({
  row,
  player,
  statPoints,
  onClose,
}: {
  row: WeekRow | null
  player: Player | undefined
  statPoints: Map<string, StatInfo> | undefined
  onClose(): void
}) {
  const name = player ? displayName(player) : 'Player'
  const started = row?.actual !== null && row?.actual !== undefined
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()} title={started ? `${name} · ${fmtPoints(row!.actual!)} pts` : name}>
      {row && (
        <div className="flex flex-col gap-3">
          {!started ? (
            <p className="text-body text-text-2">
              The game hasn’t started yet. {row.projected !== null ? `Estimate: ${row.projected.toFixed(1)} points.` : 'No estimate yet.'}
            </p>
          ) : row.breakdown.length === 0 ? (
            <p className="text-body text-text-2">No stats in this game yet.</p>
          ) : (
            <ul className="surface-inset divide-y divide-divider overflow-hidden rounded-panel">
              {row.breakdown.map((l) => (
                <li key={l.statTypeId} className="flex min-h-(--tap-min) items-center gap-3 px-3 py-2">
                  <span className="flex-1">{statPoints?.get(l.statTypeId)?.label ?? l.statTypeId}</span>
                  <span className="text-text-2 nums">×{l.value}</span>
                  <span className={`numeral w-12 text-right text-body-lg nums ${l.points > 0 ? 'text-ok' : l.points < 0 ? 'text-danger' : 'text-text-3'}`}>
                    {l.points > 0 ? '+' : ''}
                    {fmtPoints(l.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {started && row.projected !== null && (
            <p className="flex items-center gap-2 text-small text-text-2 nums">
              <Icon name="trend" size="xs" />
              Estimate was {row.projected.toFixed(1)}
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
