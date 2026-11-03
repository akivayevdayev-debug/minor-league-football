import { useState, type ReactNode } from 'react'
import { useAuth } from './auth-context'
import { ChangePasswordForm } from './ChangePasswordForm'
import { LoginScreen } from './LoginScreen'
import { NotLinkedScreen } from './NotLinkedScreen'
import { needsNewPassword } from './mustChange'
import { BrandMark } from '../../ui/BrandMark'
import { Button } from '../../ui/Button'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'

/** Shown before anything else to a member who must choose their own password (first sign-in, or a launch reset). */
function ChooseNewPasswordScreen() {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  return (
    <main className="safe-top safe-bottom relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-6">
      <StadiumBackdrop photo="lights" lightsOn />
      <div className="flex w-full max-w-(--measure-form) flex-col items-center gap-5">
        <BrandMark />
        <section className="glass-strong rise flex w-full flex-col gap-4 rounded-hero p-5">
          <header className="flex flex-col gap-2 text-center">
            <h1 className="text-title">Choose a New Password</h1>
            <p className="text-small text-text-2-strong">Pick your own password to keep using MLF. At least 8 characters.</p>
          </header>
          <ChangePasswordForm forced />
          {/* Always available, so a shared phone or a password that can't be chosen right now is never a trap. */}
          <Button
            variant="outline"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              await signOut()
            }}
          >
            Sign out
          </Button>
        </section>
      </div>
    </main>
  )
}

/** Nothing renders for strangers. While checking, only the wordmark shows (no flash of content). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, typedPasswordLength } = useAuth()
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
      return needsNewPassword(typedPasswordLength, state.member.mustChangePassword) ? <ChooseNewPasswordScreen /> : <>{children}</>
  }
}
