import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon: IconName
  title: string
  body: string
  /** Optional single action, e.g. "Add the first game". */
  action?: ReactNode
}

/** Says what is missing and what to do about it. Compact: small icon, short text. */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <section className="drill-in flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="flex size-(--badge-sm) items-center justify-center rounded-pill bg-accent-soft text-accent">
        <Icon name={icon} size="sm" />
      </span>
      <h2 className="text-body font-strong">{title}</h2>
      <p className="max-w-(--measure-narrow) text-small text-text-2">{body}</p>
      {action}
    </section>
  )
}
