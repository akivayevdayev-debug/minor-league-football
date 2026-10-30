import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePhotoUrl } from '../lib/photos'
import type { TeamColor } from '../types/db'
import { teamStyle } from './team'

const sizes = { sm: 'size-(--badge-sm) text-body', md: 'size-(--badge-md) text-title', lg: 'size-(--badge-lg) text-headline', xl: 'size-(--badge-xl) text-score' }

/** A player's photo in a round frame ringed by their team colour; the jersey number until a photo is added. */
export function PlayerBadge({
  jersey,
  team,
  photo,
  size = 'md',
}: {
  jersey: number | null
  team?: TeamColor
  /** Storage path of the player's photo (players.photo_path). */
  photo?: string | null
  size?: keyof typeof sizes
}) {
  const src = usePhotoUrl(photo)
  return (
    <Avatar aria-hidden="true" style={teamStyle(team)} className={`${sizes[size]} team-badge`}>
      {src && <AvatarImage src={src} alt="" loading="lazy" decoding="async" />}
      <AvatarFallback className="team-badge numeral text-text">{jersey ?? '–'}</AvatarFallback>
    </Avatar>
  )
}
