import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { Icon } from '../ui/Icon'
import { houseSpring } from '../ui/motion'
import { activeTabIndex, tabs } from './tabs'

/**
 * Floating liquid-glass tab bar (iOS 26 style): a clear capsule, and a brighter glass lens
 * that glides to the active tab. The active icon pops once when chosen.
 */
export function BottomNav() {
  const { pathname } = useLocation()
  const activeIndex = activeTabIndex(pathname)

  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-nav) px-(--nav-inset) pb-(--nav-gap)">
      <ul className="glass-bar pointer-events-auto mx-auto grid h-(--nav-height) max-w-(--measure-form) grid-cols-5 rounded-pill p-1">
        {tabs.map((tab, i) => {
          const isActive = i === activeIndex
          return (
            <li key={tab.to} className="flex">
              <NavLink
                to={tab.to}
                aria-current={isActive ? 'page' : undefined}
                className={`pressable relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-pill text-label font-strong ${
                  isActive ? 'text-text' : 'text-text-2 hover-fine:text-text'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-lens"
                    transition={houseSpring()}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-pill border border-(--glass-edge) bg-(--lens-fill) shadow-(--glass-specular)"
                  />
                )}
                <span key={isActive ? 'on' : 'off'} className={`relative ${isActive ? 'pop' : ''}`}>
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
