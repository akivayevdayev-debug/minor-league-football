import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '../ui/Icon'
import { numberToken } from '../ui/motion/spring'

/** Touches that start in these belong to the thing being touched, not to the page. */
const SKIP = '[role="dialog"], [data-vaul-drawer], input, textarea, select'
/** The gear never shows for less than this, so a quick reload doesn't flicker. */
const MIN_SPIN_MS = 700
/** Where the gear rests when hidden: just above its drop-in point, tucked under the top bar. */
const HIDDEN_Y = -56

/**
 * Pull down from the very top to reload: a gear drops out from under the top bar and turns as you
 * pull; letting go past the line re-fetches everything on screen and checks for a new version of the
 * app. Touch only. The game screen is outside this (see App.tsx), so the clock and score buttons
 * never feel it. Only the small gear moves (straight from the touch, no re-rendering): dragging the
 * whole screen would re-blur every glass card on each frame.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const gearRef = useRef<HTMLDivElement>(null)
  const turnRef = useRef<HTMLSpanElement>(null)
  const [reloading, setReloading] = useState(false)
  const [armed, setArmed] = useState(false)
  const busy = useRef(false)

  useEffect(() => {
    let startY: number | null = null
    let distance = 0
    let frame = 0
    let wasArmed = false
    // Read once per touch: asking the browser for styles on every finger move would slow the drag.
    let cfg = { threshold: 0, max: 0, resist: 0, hold: 0 }

    const place = (y: number, animate: boolean) => {
      const gear = gearRef.current
      if (!gear) return
      gear.style.transition = animate ? 'transform var(--dur-sheet) var(--ease-out), opacity var(--dur-fast) linear' : 'none'
      gear.style.transform = `translate3d(0, ${y}px, 0)`
      gear.style.opacity = y <= HIDDEN_Y ? '0' : '1'
    }
    const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (busy.current || e.touches.length !== 1 || !t || !atTop()) return
      if (e.target instanceof Element && e.target.closest(SKIP)) return
      startY = t.clientY
      distance = 0
      cfg = { threshold: numberToken('--pull-threshold'), max: numberToken('--pull-max'), resist: numberToken('--pull-resist'), hold: numberToken('--pull-hold') }
    }

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (startY === null || !t) return
      const dy = t.clientY - startY
      if (dy <= 0 || !atTop()) {
        // Moving up (or the page has scrolled): a normal scroll, not a pull.
        if (distance === 0) startY = null
        return
      }
      if (e.cancelable) e.preventDefault()
      distance = Math.min(dy * cfg.resist, cfg.max)
      if (frame) return // a paint is already queued; it reads the latest distance
      frame = requestAnimationFrame(() => {
        frame = 0
        place(HIDDEN_Y + distance, false)
        if (turnRef.current) turnRef.current.style.transform = `rotate(${distance * 4}deg)`
        const now = distance >= cfg.threshold
        if (now !== wasArmed) {
          wasArmed = now
          setArmed(now)
        }
      })
    }

    const onEnd = async () => {
      if (startY === null) return
      const pulled = distance
      startY = null
      distance = 0
      cancelAnimationFrame(frame)
      frame = 0
      if (pulled < cfg.threshold) {
        place(HIDDEN_Y, true)
        wasArmed = false
        setArmed(false)
        return
      }
      busy.current = true
      setReloading(true)
      place(HIDDEN_Y + cfg.hold, true)
      const started = Date.now()
      await Promise.allSettled([
        queryClient.refetchQueries({ type: 'active' }),
        navigator.serviceWorker?.getRegistration().then((r) => r?.update()),
      ])
      await new Promise((done) => setTimeout(done, Math.max(0, MIN_SPIN_MS - (Date.now() - started))))
      place(HIDDEN_Y, true)
      if (turnRef.current) turnRef.current.style.transform = 'rotate(0deg)'
      setReloading(false)
      wasArmed = false
      setArmed(false)
      busy.current = false
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [queryClient])

  return (
    <>
      <div
        ref={gearRef}
        aria-hidden
        className="pointer-events-none fixed inset-x-0 z-1 flex justify-center"
        style={{ top: 'calc(var(--header-top) + var(--header-height))', transform: `translate3d(0, ${HIDDEN_Y}px, 0)`, opacity: 0, willChange: 'transform' }}
      >
        <span className={`flex size-10 items-center justify-center rounded-pill border border-(--glass-edge) bg-panel shadow-(--glass-shadow) ${armed || reloading ? 'text-gold' : 'text-text-2'}`}>
          <span ref={turnRef} className={`flex ${reloading ? 'spin' : ''}`}>
            <Icon name="settings" size="md" />
          </span>
        </span>
      </div>
      {children}
    </>
  )
}
