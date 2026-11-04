import { useEffect, useState } from 'react'

/** The current time, refreshed every `everyMs` while `active` (nothing ticks when inactive). */
export function useNow(active: boolean, everyMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [active, everyMs])
  return now
}
