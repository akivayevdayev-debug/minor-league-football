import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '../ui/Icon'
import { durationToken, numberToken } from '../ui/motion/spring'

/** Touches that start in these belong to the thing being touched, not to the page. */
const SKIP = '[role="dialog"], [data-vaul-drawer], input, textarea, select'
/** The gear never shows for less than this, so a quick reload doesn't flicker. */
const MIN_SPIN_MS = 700
/** Height the gear needs in the gap: 40px gear plus a little air above and below. */
const GEAR_ROOM = 56

/**
 * Pull down from the very top to reload: the whole screen, top bar included, follows your finger
 * down (with resistance), opening a gap above it, and a gear in that gap turns as you pull. Letting go past the line
 * holds the gap open while everything on screen is re-fetched and the app checks for a new version,
 * then the screen springs back. Touch only. The game screen is outside this (see App.tsx), so the
 * clock and score buttons never feel it. The drag writes straight to the DOM (no re-rendering), and
 * `data-pulling` on <html> switches the glass blur off for its length so the drag stays smooth.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const screenRef = useRef<HTMLDivElement>(null)
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
    const durationMs = durationToken('--dur-sheet') * 1000
    // Read once per touch: asking the browser for styles on every finger move would slow the drag.
    let cfg = { threshold: 0, max: 0, resist: 0, hold: 0 }

    const place = (y: number, animate: boolean) => {
      const screen = screenRef.current
      const gear = gearRef.current
      if (!screen || !gear) return
      screen.style.transition = animate ? 'transform var(--dur-sheet) var(--ease-out)' : 'none'
      screen.style.transform = y > 0 ? `translate3d(0, ${y}px, 0)` : ''
      gear.style.opacity = String(Math.max(0, Math.min((y - cfg.hold + GEAR_ROOM) / GEAR_ROOM, 1)))
    }
    const setPulling = (on: boolean) => {
      if (on) document.documentElement.setAttribute('data-pulling', '')
      else document.documentElement.removeAttribute('data-pulling')
    }
    // The blur comes back once the screen has settled, so nothing pops while it is moving.
    const endPull = () => {
      wasArmed = false
      setArmed(false)
      window.setTimeout(() => {
        if (startY !== null || busy.current) return
        setPulling(false)
        if (turnRef.current) turnRef.current.style.transform = ''
      }, durationMs)
    }
    const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (busy.current || e.touches.length !== 1 || !t || !atTop()) return
      if (e.target instanceof Element && e.target.closest(SKIP)) return
      startY = t.clientY
      distance = 0
      // The gap opens at the very top of the screen, under the status bar / Dynamic Island, so the pull
      // distances all start after that strip (the gear's wrapper pads itself down by exactly that much).
      const safe = parseFloat(getComputedStyle(gearRef.current ?? document.body).paddingTop) || 0
      cfg = {
        threshold: safe + numberToken('--pull-threshold'),
        max: safe + numberToken('--pull-max'),
        resist: numberToken('--pull-resist'),
        hold: safe + GEAR_ROOM,
      }
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
      if (distance === 0) setPulling(true)
      distance = Math.min(dy * cfg.resist, cfg.max)
      if (frame) return // a paint is already queued; it reads the latest distance
      frame = requestAnimationFrame(() => {
        frame = 0
        place(distance, false)
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
        place(0, true)
        endPull()
        return
      }
      busy.current = true
      setReloading(true)
      place(cfg.hold, true)
      const started = Date.now()
      await Promise.allSettled([
        queryClient.refetchQueries({ type: 'active' }),
        navigator.serviceWorker?.getRegistration().then((r) => r?.update()),
      ])
      await new Promise((done) => setTimeout(done, Math.max(0, MIN_SPIN_MS - (Date.now() - started))))
      place(0, true)
      setReloading(false)
      busy.current = false
      endPull()
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
      {/* Fixed behind the screen: it shows only in the gap the screen leaves as it is pulled down. */}
      <div
        ref={gearRef}
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 flex justify-center"
        style={{ opacity: 0, paddingTop: 'calc(env(safe-area-inset-top, 0px) + var(--space-unit) * 2)' }}
      >
        <span className={`flex size-10 items-center justify-center rounded-pill border border-(--glass-edge) bg-panel ${armed || reloading ? 'text-gold' : 'text-text-2'}`}>
          <span ref={turnRef} className={`flex ${reloading ? 'spin' : ''}`}>
            <Icon name="settings" size="md" />
          </span>
        </span>
      </div>
      <div ref={screenRef} className="relative flex flex-1 flex-col">
        {children}
      </div>
    </>
  )
}
