import { describe, expect, it } from 'vitest'
import { remainingShare, winChance } from './winChance'

describe('winChance', () => {
  it('is a coin flip when both projections match before kickoff', () => {
    expect(winChance({ projected: 30, actual: null }, { projected: 30, actual: null }, 1)).toBeCloseTo(0.5, 5)
  })

  it('favours the side with the higher projection', () => {
    expect(winChance({ projected: 40, actual: null }, { projected: 30, actual: null }, 1)).toBeCloseTo(0.75, 1)
    expect(winChance({ projected: 30, actual: null }, { projected: 40, actual: null }, 1)).toBeCloseTo(0.25, 1)
  })

  it('is certain at the final whistle', () => {
    expect(winChance({ projected: 0, actual: 21 }, { projected: 50, actual: 14 }, 0)).toBe(1)
    expect(winChance({ projected: 0, actual: 14 }, { projected: 50, actual: 21 }, 0)).toBe(0)
    expect(winChance({ projected: 0, actual: 14 }, { projected: 50, actual: 14 }, 0)).toBe(0.5)
  })

  it('leans harder on a halftime lead than on a pre-game projection', () => {
    expect(winChance({ projected: 30, actual: 20 }, { projected: 30, actual: 10 }, 0.5)).toBeGreaterThan(0.75)
  })

  it('always returns a number between 0 and 1', () => {
    const p = winChance({ projected: 500, actual: null }, { projected: 0, actual: null }, 1)
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(1)
  })
})

describe('remainingShare', () => {
  const base = { halfMinutes: 20 }

  it('is 1 before kickoff and 0 at the final whistle', () => {
    expect(remainingShare({ ...base, status: 'scheduled', half: null, secondsLeft: null })).toBe(1)
    expect(remainingShare({ ...base, status: 'final', half: null, secondsLeft: null })).toBe(0)
  })

  it('is half at halftime', () => {
    expect(remainingShare({ ...base, status: 'halftime', half: 2, secondsLeft: 1200 })).toBe(0.5)
  })

  it('counts the second half plus what is left of the first', () => {
    expect(remainingShare({ ...base, status: 'live', half: 1, secondsLeft: 600 })).toBe(0.75)
  })

  it('counts only what is left in the second half', () => {
    expect(remainingShare({ ...base, status: 'live', half: 2, secondsLeft: 600 })).toBe(0.25)
  })

  it('falls back to half while live with no clock time', () => {
    expect(remainingShare({ ...base, status: 'live', half: null, secondsLeft: null })).toBe(0.5)
  })
})
