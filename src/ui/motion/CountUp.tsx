import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'
import { durationToken, easeToken } from './spring'

/**
 * A number that counts up once when it first appears (a rare, per-visit moment).
 * Screen readers and reduced motion get the final value straight away.
 */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = String(value)
      return
    }
    const controls = animate(0, value, {
      duration: durationToken('--dur-count'),
      ease: easeToken('--ease-out'),
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    })
    return () => controls.stop()
  }, [value, reduce])

  return (
    <span className={`nums ${className ?? ''}`} aria-label={String(value)}>
      <span ref={ref} aria-hidden="true">
        {reduce ? value : 0}
      </span>
    </span>
  )
}
