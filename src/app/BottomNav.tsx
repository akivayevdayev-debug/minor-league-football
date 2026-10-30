import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Icon, type IconName } from '../ui/Icon'
import { houseSpring } from '../ui/motion'

const tabs: { to: string; label: string; icon: IconName }[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  { to: '/standings', label: 'Standings', icon: 'standings' },
  { to: '/players', label: 'Players', icon: 'players' },
  { to: '/me', label: 'Me', icon: 'me' },
]

/** Floating glass tab bar. A cyan-lit glass pill slides to the active tab (Motion shared layout). */
export function BottomNav() {
  const { pathname } = useLocation()
  const active = tabs.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`))?.to

  return (
    <nav
      aria-label="Main"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-(--z-nav) px-(--nav-inset) pb-(--nav-inset)"
    >
      <ul className="glass-strong pointer-events-auto mx-auto grid h-(--nav-height) max-w-(--content-max) grid-cols-5 rounded-hero p-1">
        {tabs.map((tab) => {
          const isActive = tab.to === active
          return (
            <li key={tab.to} className="flex">
              <NavLink
                to={tab.to}
                aria-current={isActive ? 'page' : undefined}
                className={`pressable relative flex flex-1 flex-col items-center justify-center gap-1 rounded-panel text-label font-medium ${
                  isActive ? 'text-accent' : 'text-text-2 hover-fine:text-text'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={houseSpring()}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-panel border border-accent-soft bg-accent-soft shadow-glow-soft"
                  />
                )}
                <span className={`relative ${isActive ? 'text-glow' : ''}`}>
                  <Icon name={tab.icon} filled={isActive} />
                </span>
                <span className="relative">{tab.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
