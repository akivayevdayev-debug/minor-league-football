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

/** Holds the screen awake while `shouldHoldWakeLock` says so, and marks the page while a game is live. */
export function useKeepAwake(wanted: boolean, status: GameStatus) {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')

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
    navigator.wakeLock.request('screen').then(
      (s) => {
        if (cancelled) void s.release().catch(() => {})
        else sentinel = s
      },
      () => {
        // Refused (low battery, not allowed): the game still works, the screen may just sleep.
      },
    )
    return () => {
      cancelled = true
      void sentinel?.release().catch(() => {})
    }
  }, [hold])

  useEffect(() => {
    const live = status === 'live'
    document.documentElement.toggleAttribute('data-live', live)
    return () => document.documentElement.removeAttribute('data-live')
  }, [status])
}
