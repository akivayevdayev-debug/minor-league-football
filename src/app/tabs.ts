import type { IconName } from '../ui/Icon'

/** The four bottom tabs, in order. The order sets which way screens slide. */
export const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/team', label: 'Team', icon: 'roster' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  { to: '/mvp', label: 'MVP', icon: 'trophy' },
  { to: '/me', label: 'Me', icon: 'me' },
]

export function activeTabIndex(pathname: string) {
  return tabs.findIndex((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))
}

/** Sub-pages (not a tab) and the tab they belong to, for links opened straight from outside. */
const PARENT: { prefix: string; tab: string }[] = [
  { prefix: '/rules', tab: '/me' },
  { prefix: '/dev', tab: '/me' },
]

/** The tab a page belongs to. Tab pages are themselves; team sub-pages and unknown pages go to Team. */
export function parentTabIndex(pathname: string) {
  const direct = activeTabIndex(pathname)
  if (direct >= 0) return direct
  const match = PARENT.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`))
  return match ? tabs.findIndex((t) => t.to === match.tab) : 0
}
