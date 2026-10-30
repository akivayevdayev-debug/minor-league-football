import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Label } from '@/components/ui/label'
import { Icon } from './Icon'

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  error?: string
  children: ReactNode
}

/** The phone's own picker (best on mobile), styled as an inset glass field with a caret. */
export function Select({ label, error, children, ...rest }: SelectProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select id={id} className="field-control" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} {...rest}>
          {children}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex w-(--tap-min) items-center justify-center text-text-2">
          <Icon name="caret-down" size="xs" />
        </span>
      </div>
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-small text-danger" role="alert">
          <Icon name="error" size="xs" />
          {error}
        </p>
      )}
    </div>
  )
}
