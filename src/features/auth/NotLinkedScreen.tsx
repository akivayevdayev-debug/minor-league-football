import { useState } from 'react'
import { useAuth } from './auth-context'
import { BrandMark } from '../../ui/BrandMark'
import { Button } from '../../ui/Button'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'

/** Logged in, but the login has no player profile yet. Shows nothing else (database plan, section 2). */
export function NotLinkedScreen() {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  return (
    <main className="safe-top safe-bottom relative isolate flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-4">
      <StadiumBackdrop />
      <BrandMark size="lg" />
      <section className="glass-strong rise flex w-full max-w-(--measure-form) flex-col gap-4 rounded-hero p-6 text-center">
        <h1 className="text-title">Almost there</h1>
        <p className="text-text-2">Your login isn&rsquo;t linked to a player yet. Ask Akiva to link it.</p>
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
    </main>
  )
}
