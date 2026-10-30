import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { BottomNav } from './BottomNav'
import { activeTabIndex } from './tabs'
import { useCurrentSeason } from '../features/league'
import { BrandMark } from '../ui/BrandMark'
import { durationToken, easeToken, numberToken } from '../ui/motion/spring'

/**
 * Slim glass header, the screen, and the floating tab bar (two blurred surfaces).
 * Switching tabs slides the new screen in from the side of the tab you came from.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const season = useCurrentSeason()
  const reduce = useReducedMotion()
  const index = activeTabIndex(pathname)
  // Remember the last tab so the new screen slides in from the right side.
  const [nav, setNav] = useState({ index, dir: 0 })
  if (nav.index !== index) setNav({ index, dir: index < 0 || nav.index < 0 ? 0 : index > nav.index ? 1 : -1 })
  const dir = nav.dir
  const slide = reduce ? 0 : numberToken('--slide') * dir

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-toast) focus:rounded-control focus:bg-panel focus:px-4 focus:py-2"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>

      <header className="glass-subtle safe-top sticky top-0 z-(--z-header) rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-(--header-height) max-w-(--content-max) items-center justify-between px-4">
          <Link to="/roster" aria-label="MLF home" className="pressable flex min-h-(--tap-min) items-center">
            <BrandMark />
          </Link>
          {season.data && <span className="caps-label truncate">{season.data.name}</span>}
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-(--content-max) flex-1 overflow-x-clip px-4 pt-4 pb-[calc(var(--nav-height)+var(--nav-inset)*2+env(safe-area-inset-bottom)+var(--space-unit)*5)] outline-none"
      >
        {/* Keyed on the path so each screen plays its entrance once. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, transform: `translateX(${slide}px)` }}
          animate={{ opacity: 1, transform: 'translateX(0px)' }}
          transition={{ duration: durationToken('--dur-drill'), ease: easeToken('--ease-out') }}
        >
          <Outlet />
        </motion.div>
      </main>

      <BottomNav />
    </div>
  )
}
