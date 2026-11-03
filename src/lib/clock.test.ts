import { describe, expect, it } from 'vitest'
import { clockPhase, remainingMs, secondsLeftAt } from './clock'

// The database stores only changes: running or not, seconds left when last started/stopped,
// and the server time it started. Each phone counts down from that.
const START = Date.UTC(2026, 10, 6, 23, 0, 0)

describe('remainingMs', () => {
  it('shows the saved time while stopped', () => {
    expect(remainingMs({ running: false, secondsLeft: 600, startedAt: null }, START)).toBe(600_000)
  })

  it('counts down from the server start time while running', () => {
    expect(remainingMs({ running: true, secondsLeft: 600, startedAt: START }, START + 90_500)).toBe(509_500)
  })

  it('never goes below zero', () => {
    expect(remainingMs({ running: true, secondsLeft: 10, startedAt: START }, START + 60_000)).toBe(0)
  })

  it('does not count up when the phone is behind the server start time', () => {
    expect(remainingMs({ running: true, secondsLeft: 600, startedAt: START }, START - 2_000)).toBe(600_000)
  })
})

describe('clockPhase', () => {
  it('is running while time is left and the clock runs', () => {
    expect(clockPhase(30_000, true)).toBe('running')
  })
  it('is paused while stopped with time left', () => {
    expect(clockPhase(67_000, false)).toBe('paused')
  })
  it('is expired at zero, running or not', () => {
    expect(clockPhase(0, true)).toBe('expired')
    expect(clockPhase(0, false)).toBe('expired')
  })
})

describe('secondsLeftAt', () => {
  // Bug seen on 2026-10-30: a Pause tapped 6.6 minutes after 0:00 saved 0:02,
  // because the tap used the time from the last screen redraw (before the phone slept).
  it('a tap after the phone slept saves the real time left, not the last redraw', () => {
    const clock = { running: true, secondsLeft: 2, startedAt: START }
    expect(secondsLeftAt(clock, START + 6.6 * 60_000)).toBe(0)
  })
  it('rounds up part seconds, like the display', () => {
    expect(secondsLeftAt({ running: true, secondsLeft: 75, startedAt: START }, START + 8_400)).toBe(67)
  })
  it('keeps the saved time while stopped', () => {
    expect(secondsLeftAt({ running: false, secondsLeft: 67, startedAt: null }, START + 999_000)).toBe(67)
  })
})
