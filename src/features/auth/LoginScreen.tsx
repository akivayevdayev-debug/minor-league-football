import { useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from './auth-context'
import { Button } from '../../ui/Button'
import { BrandMark } from '../../ui/BrandMark'
import { Field } from '../../ui/Field'
import { StadiumBackdrop } from '../../ui/StadiumBackdrop'

const MESSAGES = {
  'wrong-details': "That login name or password isn't right. Check both and try again.",
  offline: "Can't reach MLF right now. Check your signal and try again.",
} as const

/** The front door. Logged out, this is the only thing that exists (frontend plan, 7.1). */
export function LoginScreen() {
  const { signIn } = useAuth()
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<keyof typeof MESSAGES | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signIn(loginName, password)
    setBusy(false)
    if (result !== 'ok') setError(result)
  }

  return (
    <main className="safe-top safe-bottom relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <StadiumBackdrop lightsOn />
      <div className="flex w-full max-w-(--measure-form) flex-col gap-8">
        <header className="rise flex flex-col items-center gap-4 text-center">
          <h1 className="sr-only">MLF, Minor League Football</h1>
          <BrandMark size="lg" subtitle />
          <p className="caps-label text-text-2-strong">Your league · Your friends · Your season</p>
        </header>

        <form onSubmit={submit} noValidate className="rise glass-strong lit flex flex-col gap-5 rounded-hero p-6" style={{ '--i': 2 } as CSSProperties}>
          <Field
            label="Login name"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            required
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
          />
          <Field
            label="Password"
            name="password"
            revealable
            autoComplete="current-password"
            enterKeyHint="go"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-body text-danger">
              {MESSAGES[error]}
            </p>
          )}
          <Button type="submit" variant="primary" size="xl" loading={busy} disabled={!loginName.trim() || !password}>
            Sign in
          </Button>
        </form>

        <p className="rise text-center text-small text-text-2" style={{ '--i': 4 } as CSSProperties}>Forgot your password? Ask Akiva to reset it.</p>
      </div>
    </main>
  )
}
