import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useAuth, type PasswordResult } from './auth-context'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'

const MIN_LENGTH = 8

const MESSAGES: Record<Exclude<PasswordResult, 'ok'>, string> = {
  'too-weak': 'That password is too easy to guess. Try a longer one.',
  'same-as-old': "That's your current password. Pick a new one.",
  failed: "Couldn't change your password. Check your signal and try again.",
}

export function ChangePasswordForm() {
  const { changePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(MESSAGES[result])
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
        error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : undefined}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        label="Type it again"
        revealable
        autoComplete="new-password"
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
