import type { TeamColor } from '../types/db'
import { teamBg } from './team'

/** Team colour as a dot or stripe, always next to the written name (colour is never the only signal). */
export function TeamName({ name, color, shape = 'dot' }: { name: string; color: TeamColor; shape?: 'dot' | 'stripe' }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={`${teamBg[color]} shrink-0 rounded-pill ${shape === 'dot' ? 'size-(--dot)' : 'h-(--icon-sm) w-(--stripe)'}`}
      />
      <span className="truncate">{name}</span>
    </span>
  )
}
