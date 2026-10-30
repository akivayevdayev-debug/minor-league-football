import { useEffect, useRef, type CSSProperties } from 'react'
import { useReducedMotion } from 'motion/react'
import type { TeamColor } from '../types/db'
import { numberToken } from './motion/spring'
import { teamStyle } from './team'

export type StadiumPhoto = 'lights' | 'bowl' | 'sunset' | 'field'

/**
 * A darkened stadium photo behind a hero, lit with the team colour. It drifts a little as the
 * page scrolls (parallax, off for reduced motion). Decorative only. Photos: public/images/CREDITS.md.
 */
export function StadiumBackdrop({
  photo = 'lights',
  team,
  lightsOn = false,
}: {
  photo?: StadiumPhoto
  team?: TeamColor | null
  lightsOn?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || reduce) return
    const max = numberToken('--parallax')
    let frame = 0
    const update = () => {
      frame = 0
      const host = el.parentElement
      if (!host) return
      const r = host.getBoundingClientRect()
      const vh = window.innerHeight
      // -1 when the hero is below the screen, +1 when it has scrolled off the top
      const p = Math.max(-1, Math.min(1, (vh / 2 - (r.top + r.height / 2)) / vh))
      el.style.translate = `0 ${(p * max).toFixed(1)}px`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [reduce])

  const style = { ...(team !== undefined ? teamStyle(team) : {}), '--photo': `var(--photo-${photo})` } as CSSProperties
  return (
    <div aria-hidden="true" className="stadium" style={style}>
      <div ref={ref} className={`stadium-photo ${lightsOn ? 'lights-on' : ''}`} />
      <div className="stadium-shade" />
      <div className="stadium-tint" />
    </div>
  )
}
