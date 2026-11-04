import type { IconName } from '../ui/Icon'

/** The five bottom tabs, in order. The order sets which way screens slide. */
export const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/team', label: 'Team', icon: 'roster' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  { to: '/league', label: 'League', icon: 'standings' },
  { to: '/mvp', label: 'MVP', icon: 'trophy' },
  { to: '/me', label: 'Me', icon: 'me' },
]

export function activeTabIndex(pathname: string) {
  return tabs.findIndex((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))
}
