import { describe, expect, it } from 'vitest'
import { remainingMs } from './clock'

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
