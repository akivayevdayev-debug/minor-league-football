import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth, type PasswordResult } from './auth-context'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { MIN_PASSWORD_LENGTH as MIN_LENGTH } from './mustChange'

const MESSAGES: Record<Exclude<PasswordResult, 'ok'>, string> = {
  'too-weak': 'That password is too easy to guess. Try a longer one.',
  'same-as-old': "That's your current password. Pick a new one.",
  failed: "Couldn't change your password. Check your signal and try again.",
  'saved-not-finished': "Your new password is saved, but we couldn't finish. Tap the button again.",
}

/** On the forced screen, a "same password" answer can also mean the user just set it before a reload. */
const FORCED_SAME_AS_OLD = "That's the password you already have. If you just set it, pick a different one."

interface ChangePasswordFormProps {
  /** True on the forced first-time screen (changes the "same password" wording). */
  forced?: boolean
}

export function ChangePasswordForm({ forced = false }: ChangePasswordFormProps) {
  const { changePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Once the password is saved but not finished, the fields lock so the retry cannot silently keep the old password.
  const [unfinished, setUnfinished] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && confirm !== password

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_LENGTH || confirm !== password) return
    setBusy(true)
    setError(null)
    const result = await changePassword(password)
    setBusy(false)
    if (result === 'ok') {
      setPassword('')
      setConfirm('')
      toast.success('Password changed')
    } else {
      setUnfinished(result === 'saved-not-finished')
      setError(result === 'same-as-old' && forced ? FORCED_SAME_AS_OLD : MESSAGES[result])
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      {/* Hidden username helps password managers save the new password against the right login. */}
      <input type="text" name="username" autoComplete="username" hidden readOnly />
      <Field
        label="New password"
        revealable
        autoComplete="new-password"
        hint={`At least ${MIN_LENGTH} characters. Don't reuse one from another site.`}
        disabled={unfinished}
        error={tooShort ? `Password must be at least ${MIN_LENGTH} characters` : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        label="Type it again"
        revealable
        autoComplete="new-password"
        disabled={unfinished}
        error={mismatch ? "The two passwords don't match." : undefined}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={busy} disabled={password.length < MIN_LENGTH || confirm !== password}>
        Change password
      </Button>
    </form>
  )
}
