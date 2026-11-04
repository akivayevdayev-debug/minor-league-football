import { lazy, Suspense, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { AuthGate, AuthProvider } from '../features/auth'
import { AppShell } from './AppShell'
import { UpdatePrompt } from './UpdatePrompt'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

// Each screen loads when first opened (only the shell and login are in the first download).
const TeamPage = lazy(() => import('../features/roster/TeamPage'))
const MatchupPage = lazy(() => import('../features/team/MatchupPage'))
const SchedulePage = lazy(() => import('../features/schedule/SchedulePage'))
const LeaguePage = lazy(() => import('../features/standings/LeaguePage'))
const GameTabPage = lazy(() => import('../features/game/GameTabPage'))
const PlayerProfile = lazy(() => import('../features/players/PlayerProfile'))
const MePage = lazy(() => import('../features/me/MePage'))
const LiveGamePage = lazy(() => import('../features/game/LiveGamePage'))
const DevToolsPage = lazy(() => import('../features/dev/DevToolsPage'))
const MvpPage = lazy(() => import('../features/mvp/MvpPage'))
const RulebookPage = lazy(() => import('../features/rules/RulebookPage'))

function Screen({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Skeleton rows={4} />}>{children}</Suspense>
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
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
                  <Route path="league" element={<Screen><LeaguePage /></Screen>} />
                  <Route path="standings" element={<Navigate to="/league" replace />} />
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
      </QueryClientProvider>
    </MotionConfig>
  )
}
