import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { AuthGate, AuthProvider } from '../features/auth'
import { AppShell } from './AppShell'
import { ScreenBoundary } from './ScreenBoundary'
import { reloadOnceForOldFile } from './screenErrors'
import { UpdatePrompt } from './UpdatePrompt'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'
import { persistOptions, queryClient } from '../lib/queryCache'

// Each screen loads when first opened (only the shell and login are in the first download).
// Once the app has loaded, the four tabs and the player card download quietly, so the first tap on each opens at once.
function preloadScreens() {
  void import('../features/roster/TeamPage')
  void import('../features/schedule/SchedulePage')
  void import('../features/mvp/MvpPage')
  void import('../features/me/MePage')
  void import('../features/players/PlayerProfile')
  void import('../features/team/MatchupPage')
}
if (typeof window !== 'undefined') {
  const later = () => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(preloadScreens)
    else setTimeout(preloadScreens, 1500)
  }
  if (document.readyState === 'complete') later()
  else window.addEventListener('load', later, { once: true })
}
const TeamPage = lazy(() => import('../features/roster/TeamPage'))
const MatchupPage = lazy(() => import('../features/team/MatchupPage'))
const SchedulePage = lazy(() => import('../features/schedule/SchedulePage'))
const GameTabPage = lazy(() => import('../features/game/GameTabPage'))
const PlayerProfile = lazy(() => import('../features/players/PlayerProfile'))
const MePage = lazy(() => import('../features/me/MePage'))
const LiveGamePage = lazy(() => import('../features/game/LiveGamePage'))
const DevToolsPage = lazy(() => import('../features/dev/DevToolsPage'))
const MvpPage = lazy(() => import('../features/mvp/MvpPage'))
const RulebookPage = lazy(() => import('../features/rules/RulebookPage'))

function Screen({ children }: { children: ReactNode }) {
  return (
    <ScreenBoundary>
      <Suspense fallback={<Skeleton rows={4} />}>{children}</Suspense>
    </ScreenBoundary>
  )
}
// Vite reports a screen file that failed to download (usually an old version's file after an update).
if (typeof window !== 'undefined') window.addEventListener('vite:preloadError', () => reloadOnceForOldFile())

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      {/* Shows the last data saved on this phone at once, then refreshes it in the background. */}
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <AuthGate>
            <HashRouter>
              <Routes>
                {/* Game night is full screen, outside the menu. */}
                <Route path="game/:id" element={<Screen><LiveGamePage /></Screen>} />
                <Route element={<AppShell />}>
                  <Route index element={<Navigate to="/team" replace />} />
                  <Route path="team" element={<Screen><TeamPage /></Screen>} />
                  <Route path="roster" element={<Navigate to="/team" replace />} />
                  <Route path="matchup/:id" element={<Screen><MatchupPage /></Screen>} />
                  <Route path="home" element={<Navigate to="/team" replace />} />
                  <Route path="schedule" element={<Screen><SchedulePage /></Screen>} />
                  <Route path="league" element={<Navigate to="/mvp" replace />} />
                  <Route path="standings" element={<Navigate to="/mvp" replace />} />
                  <Route path="game" element={<Screen><GameTabPage /></Screen>} />
                  <Route path="players" element={<Navigate to="/team" replace />} />
                  <Route path="players/:id" element={<Screen><PlayerProfile /></Screen>} />
                  <Route path="mvp" element={<Screen><MvpPage /></Screen>} />
                  <Route path="me" element={<Screen><MePage /></Screen>} />
                  <Route path="rules" element={<Screen><RulebookPage /></Screen>} />
                  {/* Owner only: the page itself sends everyone else home. */}
                  <Route path="dev" element={<Screen><DevToolsPage /></Screen>} />
                  {/* Old links keep working. */}
                  <Route path="games" element={<Navigate to="/schedule" replace />} />
                  <Route path="settings" element={<Navigate to="/me" replace />} />
                  <Route path="more" element={<Navigate to="/me" replace />} />
                  <Route
                    path="*"
                    element={<EmptyState icon="error" title="Page not found" body="That link doesn't go anywhere. Use the menu below." />}
                  />
                </Route>
              </Routes>
            </HashRouter>
          </AuthGate>
        </AuthProvider>
        <Toaster
          theme="dark"
          position="top-center"
          offset="calc(var(--header-top) + var(--header-height) + var(--toast-gap))"
          mobileOffset="calc(var(--header-top) + var(--header-height) + var(--toast-gap))"
          closeButton
          toastOptions={{ classNames: { toast: 'glass-strong! rounded-panel! text-text! font-body!' } }}
        />
        <UpdatePrompt />
      </PersistQueryClientProvider>
    </MotionConfig>
  )
}
