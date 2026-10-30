import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

interface EmptyStateProps {
  icon: IconName
  title: string
  body: string
  /** Optional single action, e.g. "Add the first game". */
  action?: ReactNode
}

/** Says what is missing and what to do about it. */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <section className="drill-in flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-(--badge-md) items-center justify-center rounded-pill border border-accent-soft bg-accent-soft text-accent shadow-glow-soft">
        <Icon name={icon} />
      </span>
      <h2 className="text-title">{title}</h2>
      <p className="max-w-(--measure-narrow) text-text-2">{body}</p>
      {action}
    </section>
  )
}
