import { Component, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ErrorState } from '../ui/ErrorState'
import { isOldFileError, reloadOnceForOldFile } from './screenErrors'

interface State {
  failed: boolean
}

class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // After an update the old screen files are gone: reload once to get the new ones.
    if (isOldFileError(error)) reloadOnceForOldFile()
  }

  render() {
    if (this.state.failed) return <ErrorState what="this screen" onRetry={() => window.location.reload()} />
    return this.props.children
  }
}

/**
 * Catches a screen that breaks so only that screen shows "Try again"; the top bar, the tabs and
 * Back keep working. Keyed on the address, so moving to another page starts it fresh.
 */
export function ScreenBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <Boundary key={pathname}>{children}</Boundary>
}
