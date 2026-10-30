import { Link, Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { BrandMark } from '../ui/BrandMark'
import { Icon } from '../ui/Icon'

/** Slim glass header, the screen, and the floating tab bar. Two blurred surfaces (header, nav). */
export function AppShell() {
  const { pathname } = useLocation()
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

      <header className="glass-subtle safe-top sticky top-0 z-(--z-header) rounded-none border-x-0 border-t-0 shadow-none">
        <div className="mx-auto flex h-(--header-height) max-w-(--content-max) items-center justify-between px-4">
          <Link to="/home" aria-label="MLF home" className="pressable flex min-h-(--tap-min) items-center">
            <BrandMark />
          </Link>
          <Link
            to="/me"
            aria-label="Me"
            className="pressable -mr-2 flex size-(--tap-min) items-center justify-center rounded-pill text-text-2 hover-fine:text-accent"
          >
            <Icon name="me" />
          </Link>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-(--content-max) flex-1 px-4 pt-5 pb-[calc(var(--nav-height)+var(--nav-inset)*2+env(safe-area-inset-bottom)+var(--space-unit)*6)] outline-none"
      >
        {/* Keyed on the path so each screen plays its entrance once. */}
        <div key={pathname} className="drill-in">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
