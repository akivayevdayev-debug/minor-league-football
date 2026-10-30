import type { CSSProperties } from 'react'
import type { Team } from '../types/db'
import { teamVar } from './team'

const sizes = { sm: 'size-(--badge-sm) text-small', md: 'size-(--badge-md) text-body', lg: 'size-(--badge-lg) text-title', xl: 'size-(--badge-xl) text-headline' }

/** Round monogram badge ringed in the team colour. Decorative: the team name is always written nearby. */
export function TeamBadge({ team, size = 'md' }: { team: Pick<Team, 'short_name' | 'color_key'> | undefined; size?: keyof typeof sizes }) {
  const style = team ? ({ '--team': teamVar(team.color_key) } as CSSProperties) : undefined
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`${sizes[size]} ${team ? 'team-badge text-text' : 'surface-inset text-text-2'} flex shrink-0 items-center justify-center rounded-pill font-display font-bold tracking-label uppercase`}
    >
      {team ? team.short_name.slice(0, 3) : '?'}
    </span>
  )
}
