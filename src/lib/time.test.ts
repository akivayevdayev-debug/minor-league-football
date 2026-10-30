import { describe, expect, it } from 'vitest'
import { formatGameTime, fromZonedInput, shiftDays, toZonedInput } from './time'

describe('New York time', () => {
  it('reads a picked wall time as New York time, summer and winter', () => {
    expect(fromZonedInput('2026-07-04T16:30')).toBe('2026-07-04T20:30:00.000Z') // EDT, UTC-4
    expect(fromZonedInput('2026-12-06T16:30')).toBe('2026-12-06T21:30:00.000Z') // EST, UTC-5
  })

  it('round-trips a saved time back into the picker', () => {
    expect(toZonedInput('2026-12-06T21:30:00.000Z')).toBe('2026-12-06T16:30')
  })

  it('keeps "same time" across the clocks going back (Nov 1, 2026)', () => {
    // Sat Oct 31 4:30 PM EDT → Sat Nov 7 4:30 PM EST
    expect(shiftDays('2026-10-31T20:30:00.000Z', 7)).toBe('2026-11-07T21:30:00.000Z')
  })

  it('formats a game time short, in New York time', () => {
    expect(formatGameTime('2026-11-07T21:30:00.000Z')).toBe('Sat, Nov 7, 4:30 PM')
  })
})
