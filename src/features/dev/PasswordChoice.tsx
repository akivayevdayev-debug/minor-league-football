import { Field } from '../../ui/Field'
import { Segmented } from '../../ui/motion'
import { MIN_PASSWORD_LENGTH } from '../auth/mustChange'
import { typedPasswordProblem, type PasswordMode } from './devLogic'

const OPTIONS = [
  { value: 'temp', label: 'Temporary' },
  { value: 'typed', label: 'Type one' },
] as const

/**
 * Temporary (made for you, shown once, they pick their own at sign-in) or typed (yours to choose,
 * kept as theirs until it is reset). The typed password lives only in the sheet's state.
 */
export function PasswordChoice({
  name,
  mode,
  onModeChange,
  password,
  onPasswordChange,
}: {
  name: string
  mode: PasswordMode
  onModeChange(mode: PasswordMode): void
  password: string
  onPasswordChange(password: string): void
}) {
  const problem = password ? typedPasswordProblem(password, MIN_PASSWORD_LENGTH) : null
  return (
    <div className="flex flex-col gap-3">
      <Segmented label="Password" value={mode} onChange={onModeChange} options={OPTIONS} />
      {mode === 'typed' && (
        <Field
          label={`Password for ${name}`}
          revealable
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. It stays theirs until it is reset.`}
          error={problem ?? undefined}
        />
      )}
    </div>
  )
}

