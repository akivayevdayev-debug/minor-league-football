import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

/** Section title in sentence case, with a small "See all" link. */
export function SectionHeader({ title, to, linkLabel = 'See all', children }: { title: string; to?: string; linkLabel?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-body-lg">{title}</h2>
      {to && (
        <Link to={to} className="pressable -mr-2 flex min-h-(--tap-min) items-center gap-0.5 px-2 text-small text-accent hover-fine:underline">
          {linkLabel}
          <Icon name="chevron" size="xs" />
        </Link>
      )}
      {children}
    </div>
  )
}
