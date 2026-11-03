import { describe, expect, it } from 'vitest'
import { shouldHoldWakeLock } from './wakeLock'

// The screen is held awake only while the game is live, the phone is on and the page is visible.
describe('shouldHoldWakeLock', () => {
  it('holds the screen on while a live game is wanted and the page is visible', () => {
    expect(shouldHoldWakeLock(true, 'live', true)).toBe(true)
  })
  it('lets the screen sleep at halftime', () => {
    expect(shouldHoldWakeLock(true, 'halftime', true)).toBe(false)
  })
  it('lets the screen sleep after the final whistle', () => {
    expect(shouldHoldWakeLock(true, 'final', true)).toBe(false)
  })
  it('lets the screen sleep before kickoff', () => {
    expect(shouldHoldWakeLock(true, 'scheduled', true)).toBe(false)
  })
  it('does nothing when the coach has not asked for it', () => {
    expect(shouldHoldWakeLock(false, 'live', true)).toBe(false)
  })
  it('does nothing while the page is hidden', () => {
    expect(shouldHoldWakeLock(true, 'live', false)).toBe(false)
  })
})
