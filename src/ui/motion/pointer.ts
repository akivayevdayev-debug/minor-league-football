/*
 * One delegated pointer listener for the whole app (installed once in main.tsx):
 *  - .lit elements get --px/--py so their spotlight follows the mouse.
 *  - .magnetic elements lean a few pixels toward the mouse (limit: --magnet-max).
 *  - .ripple elements get a soft wave where the finger or mouse presses (touch too).
 * Light and lean are mouse only; all of it is off when the person asks for reduced motion.
 */
const finePointer = '(hover: hover) and (pointer: fine)'
const reduced = '(prefers-reduced-motion: reduce)'

function tokenNumber(name: string): number {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0
}

function onPress(e: PointerEvent) {
  if (!(e.target instanceof Element) || window.matchMedia(reduced).matches) return
  const host = e.target.closest<HTMLElement>('.ripple')
  if (!host || host.closest('.still') || host.matches(':disabled, [aria-disabled="true"]')) return
  const r = host.getBoundingClientRect()
  const wave = document.createElement('span')
  wave.className = 'ripple-wave'
  wave.setAttribute('aria-hidden', 'true')
  wave.style.setProperty('--rx', `${e.clientX - r.left}px`)
  wave.style.setProperty('--ry', `${e.clientY - r.top}px`)
  wave.addEventListener('animationend', () => wave.remove(), { once: true })
  host.appendChild(wave)
}

export function installPointerEffects(): () => void {
  if (typeof window === 'undefined') return () => {}
  document.addEventListener('pointerdown', onPress, { passive: true })
  if (!window.matchMedia(finePointer).matches) return () => document.removeEventListener('pointerdown', onPress)
  const magnetMax = tokenNumber('--magnet-max')
  let frame = 0
  let last: PointerEvent | null = null
  let magnet: HTMLElement | null = null

  function apply() {
    frame = 0
    const e = last
    if (!e || !(e.target instanceof Element)) return
    const lit = e.target.closest<HTMLElement>('.lit')
    if (lit) {
      const r = lit.getBoundingClientRect()
      lit.style.setProperty('--px', `${e.clientX - r.left}px`)
      lit.style.setProperty('--py', `${e.clientY - r.top}px`)
    }
    const next = window.matchMedia(reduced).matches ? null : e.target.closest<HTMLElement>('.still') ? null : e.target.closest<HTMLElement>('.magnetic:not(:disabled)')
    if (magnet && magnet !== next) magnet.style.translate = ''
    magnet = next
    if (next) {
      const r = next.getBoundingClientRect()
      const dx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * magnetMax
      const dy = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * magnetMax
      next.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`
    }
  }

  function onMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    last = e
    if (!frame) frame = requestAnimationFrame(apply)
  }
  function onLeave() {
    if (magnet) magnet.style.translate = ''
    magnet = null
  }

  document.addEventListener('pointermove', onMove, { passive: true })
  document.addEventListener('pointerleave', onLeave)
  return () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerleave', onLeave)
    document.removeEventListener('pointerdown', onPress)
    cancelAnimationFrame(frame)
  }
}
