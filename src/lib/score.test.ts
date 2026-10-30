import { describe, expect, it } from 'vitest'
import { gameScore } from './score'

const HOME = 'tigers'
const AWAY = 'daybies'

describe('gameScore', () => {
  it('adds up non-voided score lines per team and names the result', () => {
    const score = gameScore(HOME, AWAY, [
      { teamId: HOME, points: 6, voided: false },
      { teamId: HOME, points: 1, voided: false },
      { teamId: AWAY, points: 6, voided: false },
      { teamId: AWAY, points: 6, voided: true },
    ])
    expect(score).toEqual({ home: 7, away: 6, result: 'home' })
  })
})

describe('gameScore edge cases', () => {
  it('calls it a tie at 0-0 with no lines', () => {
    expect(gameScore(HOME, AWAY, [])).toEqual({ home: 0, away: 0, result: 'tie' })
  })

  it('ignores lines for a team that is not in the game', () => {
    expect(gameScore(HOME, AWAY, [{ teamId: 'demons', points: 6, voided: false }])).toEqual({ home: 0, away: 0, result: 'tie' })
  })

  it('takes a hand-entered final score line as-is (imported games)', () => {
    const score = gameScore(HOME, AWAY, [
      { teamId: HOME, points: 20, voided: false },
      { teamId: AWAY, points: 27, voided: false },
    ])
    expect(score.result).toBe('away')
  })
})
