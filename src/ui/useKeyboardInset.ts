import { useEffect } from 'react'

/**
 * Keeps a sheet above the phone keyboard. On iPhone the keyboard covers the bottom of the screen and
 * the page may also slide up, so this measures what is still visible (window.visualViewport) and sets
 * --keyboard-inset and --visible-height on the page. Only runs while `active` (a sheet is open).
 */
export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    const vv = window.visualViewport
    if (!active || !vv) return
    const root = document.documentElement.style
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
      root.setProperty('--visible-height', `${Math.round(vv.height)}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      root.removeProperty('--keyboard-inset')
      root.removeProperty('--visible-height')
    }
  }, [active])
}
