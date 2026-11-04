import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { durationToken, easeToken } from './spring'

/**
 * A number that counts up when it appears, or when its value changes.
 * `from="zero"` (default) counts from 0 each time. `from="previous"` counts from the last value shown,
 * so a switch between two totals counts between them.
 * Screen readers and reduced motion get the final value straight away.
 */
export function CountUp({ value, className, from = 'zero' }: { value: number; className?: string; from?: 'zero' | 'previous' }) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = String(value)
      shown.current = value
      return
    }
    const controls = animate(from === 'previous' ? shown.current : 0, value, {
      duration: durationToken('--dur-count'),
      ease: easeToken('--ease-out'),
      onUpdate: (v) => {
        shown.current = Math.round(v)
        el.textContent = String(shown.current)
      },
    })
    return () => controls.stop()
  }, [value, reduce, from])

  return (
    <span className={`nums ${className ?? ''}`} aria-label={String(value)}>
      <span ref={ref} aria-hidden="true">
        {reduce ? value : 0}
      </span>
    </span>
  )
}
