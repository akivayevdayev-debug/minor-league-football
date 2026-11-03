/*
 * Keep the screen on during a live game. The screen is held only while the game is live and the page
 * is visible: the browser drops the lock when the page is hidden, so it is asked for again on return.
 * Battery (spec C7): while a game is live, <html data-live> pauses the background light animations.
 */
import { useEffect, useState } from 'react'
import type { GameStatus } from '../../types/db'

export function shouldHoldWakeLock(wanted: boolean, status: GameStatus, visible: boolean): boolean {
  return wanted && status === 'live' && visible
}

const storeKey = (gameId: string) => `mlf-keep-awake:${gameId}`

/** Whether the coach asked to keep this game's screen on. Per tab: sessionStorage, and it never throws. */
function readWanted(gameId: string): boolean {
  try {
    return sessionStorage.getItem(storeKey(gameId)) === '1'
  } catch {
    return false
  }
}

function writeWanted(gameId: string, wanted: boolean) {
  try {
    if (wanted) sessionStorage.setItem(storeKey(gameId), '1')
    else sessionStorage.removeItem(storeKey(gameId))
  } catch {
    // Storage blocked (private window): the choice just lasts until the page reloads.
  }
}

/** The keep-awake choice for one game, and a toggle for it. */
export function useKeepAwakeSetting(gameId: string): [boolean, () => void] {
  const [wanted, setWanted] = useState(() => readWanted(gameId))
  const toggle = () => {
    const next = !wanted
    setWanted(next)
    writeWanted(gameId, next)
  }
  return [wanted, toggle]
}

/** The button's words: what the coach asked for, and whether the phone went along with it. */
export function keepAwakeLabel(on: boolean, state: KeepAwakeState): string {
  if (!on) return 'Keep screen on'
  if (state === 'refused') return "Phone won't keep the screen on"
  return 'Screen stays on'
}

/** What happened to the keep-awake request: not asked for right now, held, or refused by the browser. */
export type KeepAwakeState = 'off' | 'held' | 'refused'

/**
 * Holds the screen awake while `shouldHoldWakeLock` says so, and marks the page while a game is live.
 * If the browser lets go of the lock while the page is still visible, it is asked for again once.
 */
export function useKeepAwake(wanted: boolean, status: GameStatus): KeepAwakeState {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const [state, setState] = useState<KeepAwakeState>('off')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  const hold = shouldHoldWakeLock(wanted, status, visible)
  useEffect(() => {
    if (!hold || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false
    const onRelease = () => {
      // The browser let go while we still want it (and the page is visible): ask again.
      if (!cancelled && document.visibilityState !== 'hidden') setAttempt((n) => n + 1)
    }
    navigator.wakeLock.request('screen').then(
      (s) => {
        if (cancelled) {
          void s.release().catch(() => {})
          return
        }
        sentinel = s
        s.addEventListener('release', onRelease)
        setState('held')
      },
      () => {
        // Refused (low battery, not allowed): the game still works, the screen may just sleep.
        if (!cancelled) setState('refused')
      },
    )
    return () => {
      cancelled = true
      sentinel?.removeEventListener('release', onRelease)
      void sentinel?.release().catch(() => {})
    }
  }, [hold, attempt])

  useEffect(() => {
    const live = status === 'live'
    document.documentElement.toggleAttribute('data-live', live)
    return () => document.documentElement.removeAttribute('data-live')
  }, [status])

  return hold ? state : 'off'
}
