import type { ReactNode } from 'react'
import { useAuth } from './auth-context'
import { LoginScreen } from './LoginScreen'
import { NotLinkedScreen } from './NotLinkedScreen'

/** Nothing renders for strangers. While checking, only the wordmark shows (no flash of content). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  switch (state.status) {
    case 'loading':
      return (
        <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
          <p className="brand-type text-headline text-text-3">MLF</p>
        </main>
      )
    case 'signed-out':
      return <LoginScreen />
    case 'unlinked':
      return <NotLinkedScreen />
    case 'member':
      return <>{children}</>
  }
}
