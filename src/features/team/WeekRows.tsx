import { Badge } from '@/components/ui/badge'
import { displayName } from '../league'
import type { Player, Team } from '../../types/db'
import { Icon } from '../../ui/Icon'
import { PlayerBadge } from '../../ui/PlayerBadge'
import { Sheet } from '../../ui/Sheet'
import type { StatInfo } from './useTeamWeek'
import { fmtPoints, type WeekRow } from './week'

/**
 * One player on the Team tab: position, name, estimate and (once the game starts) actual points.
 * Tap the name for the player; tap the points to see how they were scored.
 */
export function TeamPlayerRow({
  row,
  player,
  team,
  onField,
  onOpen,
  onPoints,
}: {
  row: WeekRow
  player: Player | undefined
  team: Team | undefined
  onField: boolean
  onOpen(): void
  onPoints(): void
}) {
  const name = player ? displayName(player) : 'Unknown player'
  const started = row.actual !== null
  return (
    <li className="flex items-stretch">
      <button
        type="button"
        onClick={onOpen}
        className="pressable lit flex min-h-(--tap-min) min-w-0 flex-1 items-center gap-3 bg-transparent py-2 pl-3 pr-1 text-left hover-fine:bg-(--row-hover)"
      >
        <span className={`w-10 shrink-0 rounded-chip py-0.5 text-center caps-label ${row.isQb ? 'bg-gold-soft text-gold' : 'bg-(--press-fill) text-text'}`}>
          {row.position}
        </span>
        <PlayerBadge jersey={player?.jersey ?? null} team={row.isQb ? undefined : team?.color_key} photo={player?.photo_path ?? null} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
          <span className="w-full truncate font-strong">{name}</span>
          {row.isQb ? (
            <span className="caps-label">QB this week</span>
          ) : onField ? (
            <Badge variant="live">On field</Badge>
          ) : player?.is_guest ? (
            <span className="caps-label">Guest</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onPoints}
        aria-label={started ? `${name}: ${fmtPoints(row.actual!)} points. Show how they were scored` : `${name}: estimate ${row.projected?.toFixed(1) ?? 'none'}`}
        className="pressable lit flex min-h-(--tap-min) w-24 shrink-0 flex-col items-end justify-center bg-transparent px-3 py-2 leading-tight hover-fine:bg-(--row-hover)"
      >
        {started ? (
          <>
            <span className="numeral text-body-lg nums">{fmtPoints(row.actual!)}</span>
            <span className="caps-label nums whitespace-nowrap">{row.projected !== null ? `proj ${row.projected.toFixed(1)}` : 'pts'}</span>
          </>
        ) : (
          <>
            <span className="numeral text-body-lg nums text-text-2-strong">{row.projected !== null ? row.projected.toFixed(1) : '—'}</span>
            <span className="caps-label">proj</span>
          </>
        )}
      </button>
    </li>
  )
}

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
