import { useId } from 'react'
import type { Team } from '../types/db'
import { Icon } from './Icon'
import { teamMotif, teamStyle } from './team'

const sizes = {
  sm: { box: 'w-(--badge-sm)', icon: 'xs', text: 'text-label' },
  md: { box: 'w-(--badge-md)', icon: 'sm', text: 'text-label' },
  lg: { box: 'w-(--badge-lg)', icon: 'md', text: 'text-small' },
  xl: { box: 'w-(--badge-xl)', icon: 'lg', text: 'text-body' },
} as const

/**
 * Team crest: a shield filled with the team gradient, the team's motif (lightning, sun, paw)
 * and its short name. A light sweep crosses it on hover. Decorative: the name is always written nearby.
 */
export function TeamBadge({ team, size = 'md' }: { team: Pick<Team, 'short_name' | 'color_key'> | undefined; size?: keyof typeof sizes }) {
  const id = useId().replace(/:/g, '')
  const s = sizes[size]
  const small = size === 'sm'
  return (
    <span aria-hidden="true" style={teamStyle(team?.color_key)} className={`crest ${s.box} aspect-[5/6]`}>
      <svg viewBox="0 0 100 120" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="var(--team-light)" />
            <stop offset="0.45" stopColor="var(--team)" />
            <stop offset="1" stopColor="var(--team-deep)" />
          </linearGradient>
          <linearGradient id={`r${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--glass-rim-bright)" />
            <stop offset="0.5" stopColor="var(--glass-rim-dim)" />
            <stop offset="1" stopColor="var(--glass-border-strong)" />
          </linearGradient>
          <clipPath id={`c${id}`}>
            <path d="M50 3 L94 16 V58 C94 86 74 106 50 117 C26 106 6 86 6 58 V16 Z" />
          </clipPath>
        </defs>
        <path d="M50 3 L94 16 V58 C94 86 74 106 50 117 C26 106 6 86 6 58 V16 Z" fill={`url(#f${id})`} />
        <g clipPath={`url(#c${id})`}>
          {/* inner bevel and a diagonal light band */}
          <path d="M50 12 L86 22 V58 C86 81 70 98 50 108 C30 98 14 81 14 58 V22 Z" fill="none" stroke="var(--glass-highlight)" strokeWidth="2" />
          <rect className="crest-shine" x="-20" y="-10" width="40" height="140" fill="var(--glass-highlight)" transform="rotate(20 50 60)" />
          <rect x="0" y="0" width="100" height="44" fill="var(--glass-highlight)" opacity="0.6" />
        </g>
        <path d="M50 3 L94 16 V58 C94 86 74 106 50 117 C26 106 6 86 6 58 V16 Z" fill="none" stroke={`url(#r${id})`} strokeWidth="2.5" />
      </svg>
      <span className="relative flex size-full flex-col items-center justify-center gap-0.5 pb-[12%] text-text">
        {team ? (
          <>
            <Icon name={teamMotif[team.color_key]} size={s.icon} filled />
            {!small && <span className={`${s.text} display-caps leading-none font-bold tracking-label`}>{team.short_name.slice(0, 3)}</span>}
          </>
        ) : (
          <span className={`${s.text} display-caps`}>?</span>
        )}
      </span>
    </span>
  )
}
