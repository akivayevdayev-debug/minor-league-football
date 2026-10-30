import { useId } from 'react'
import { Icon } from './Icon'

interface StepperProps {
  label: string
  value: number
  onChange(value: number): void
  min?: number
  max?: number
  /** Bigger buttons and number (score entry). */
  big?: boolean
  hint?: string
  /** The label is shown elsewhere (still read by screen readers). */
  labelHidden?: boolean
}

/** − number + control. The number can also be typed. Buttons press-scale only (stat pad rule). */
export function Stepper({ label, value, onChange, min = 0, max = 999, big = false, hint, labelHidden = false }: StepperProps) {
  const id = useId()
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  const btn = `pressable flex shrink-0 items-center justify-center rounded-pill surface-inset text-text disabled:opacity-35 hover-fine:bg-(--row-hover) ${big ? 'size-(--tap-game)' : 'size-(--control-h)'}`
  return (
    <div className={`flex items-center gap-3 ${labelHidden ? 'justify-end' : 'justify-between'}`}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'min-w-0 flex-1'}>
        <span className="block truncate font-strong">{label}</span>
        {hint && <span className="block text-small text-text-2">{hint}</span>}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={`One less ${label}`}>
          <Icon name="minus" size="sm" />
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ''))
            if (Number.isFinite(n)) onChange(clamp(n))
          }}
          onFocus={(e) => e.target.select()}
          className={`field-control nums text-center font-strong ${big ? 'h-(--tap-game) w-(--badge-lg) px-0 text-title' : 'w-(--badge-md) px-0'}`}
        />
        <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={`One more ${label}`}>
          <Icon name="add" size="sm" />
        </button>
      </div>
    </div>
  )
}
