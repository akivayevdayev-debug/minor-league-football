import type { ReactNode } from 'react'

/** One line of App info: a label, the value, and an optional control. */
export function AppInfoRow({ label, value, icon, action }: { label: string; value: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex min-h-(--tap-min) items-center gap-3 border-t border-divider px-3 py-2.5 first:border-t-0">
      {icon}
      <span className="flex-1 text-body">{label}</span>
      <span className="nums text-small text-text-2">{value}</span>
      {action}
    </li>
  )
}
