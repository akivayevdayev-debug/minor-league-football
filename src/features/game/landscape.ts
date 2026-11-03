import { useSyncExternalStore } from 'react'

const QUERY = '(orientation: landscape) and (max-height: 500px)'

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** True while the phone is held sideways (short, wide screen). */
export function useLandscape(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false)
}
