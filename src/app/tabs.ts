import type { IconName } from '../ui/Icon'

/** The five bottom tabs, in order. The order sets which way screens slide. */
export const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/roster', label: 'Roster', icon: 'roster' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  { to: '/standings', label: 'Standings', icon: 'standings' },
  { to: '/game', label: 'Game', icon: 'clock' },
  { to: '/me', label: 'Me', icon: 'me' },
]

export function activeTabIndex(pathname: string) {
  return tabs.findIndex((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))
}
