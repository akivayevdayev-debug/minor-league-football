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
const RosterPage = lazy(() => import('../features/roster/RosterPage'))
const SchedulePage = lazy(() => import('../features/schedule/SchedulePage'))
const StandingsPage = lazy(() => import('../features/standings/StandingsPage'))
const GameTabPage = lazy(() => import('../features/game/GameTabPage'))
const PlayerProfile = lazy(() => import('../features/players/PlayerProfile'))
const MePage = lazy(() => import('../features/me/MePage'))
const LiveGamePage = lazy(() => import('../features/game/LiveGamePage'))

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
                  <Route index element={<Navigate to="/roster" replace />} />
                  <Route path="roster" element={<Screen><RosterPage /></Screen>} />
                  <Route path="home" element={<Navigate to="/roster" replace />} />
                  <Route path="schedule" element={<Screen><SchedulePage /></Screen>} />
                  <Route path="standings" element={<Screen><StandingsPage /></Screen>} />
                  <Route path="game" element={<Screen><GameTabPage /></Screen>} />
                  <Route path="players" element={<Navigate to="/roster" replace />} />
                  <Route path="players/:id" element={<Screen><PlayerProfile /></Screen>} />
                  <Route path="me" element={<Screen><MePage /></Screen>} />
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
