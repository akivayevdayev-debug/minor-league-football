import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { TeamColor } from '../types/db'
import { teamStyle } from './team'

const sizes = { sm: 'size-(--badge-sm) text-body', md: 'size-(--badge-md) text-title', lg: 'size-(--badge-lg) text-headline', xl: 'size-(--badge-xl) text-score' }

/** A player's jersey number in a round frame tinted by their team (shadcn Avatar; photos later). */
export function PlayerBadge({ jersey, team, size = 'md' }: { jersey: number | null; team?: TeamColor; size?: keyof typeof sizes }) {
  return (
    <Avatar aria-hidden="true" style={teamStyle(team)} className={sizes[size]}>
      <AvatarFallback className="team-badge numeral text-text">{jersey ?? '–'}</AvatarFallback>
    </Avatar>
  )
}
