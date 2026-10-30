import { useId, useState, type InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Icon } from './Icon'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  hint?: string
  error?: string
  /** Adds a show/hide button for passwords. */
  revealable?: boolean
}

/** Labelled input with hint and inline error. Paste is never blocked. */
export function Field({ label, hint, error, revealable = false, type = 'text', className, ...rest }: FieldProps) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  const inputType = revealable ? (shown ? 'text' : 'password') : type

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={revealable ? 'pr-(--tap-min)' : undefined}
          {...rest}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            className="pressable absolute inset-y-0 right-0 flex w-(--tap-min) items-center justify-center text-text-2 hover-fine:text-text"
          >
            <Icon name={shown ? 'hide' : 'show'} size="sm" />
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-small text-text-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-small text-danger" role="alert">
          <Icon name="error" size="xs" />
          {error}
        </p>
      )}
    </div>
  )
}
