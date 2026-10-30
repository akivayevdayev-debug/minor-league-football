import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

/** Section title in condensed caps, with an optional "See all" link. */
export function SectionHeader({ title, to, linkLabel = 'See all', children }: { title: string; to?: string; linkLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-title">{title}</h2>
      {to && (
        <Link to={to} className="pressable flex min-h-(--tap-min) items-center gap-1 caps-label hover-fine:text-accent">
          {linkLabel}
          <Icon name="chevron" size="xs" />
        </Link>
      )}
      {children}
    </div>
  )
}
