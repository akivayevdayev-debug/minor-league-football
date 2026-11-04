import { describe, expect, it } from 'vitest'
import type { Game } from '../../types/db'
import { streaks } from './streak'

const game = (id: string, week: number, home: string, away: string, extra: Partial<Game> = {}): Game => ({
  id,
  season_id: 's',
  week,
  starts_at: null,
  field: null,
  home_team_id: home,
  away_team_id: away,
  status: 'final',
  kind: 'regular',
  home_qb_id: null,
  away_qb_id: null,
  voided_at: null,
  ...extra,
})
const score = (home_points: number, away_points: number) => ({ home_points, away_points })

describe('streaks', () => {
  it('counts the latest run of the same result for each team', () => {
    const games = [game('g1', 1, 'A', 'B'), game('g2', 2, 'B', 'A'), game('g3', 3, 'A', 'B')]
    const scores = new Map([
      ['g1', score(10, 20)], // A L, B W
      ['g2', score(7, 14)], // B L, A W
      ['g3', score(21, 0)], // A W, B L
    ])
    expect(Object.fromEntries(streaks(games, scores))).toEqual({ A: 'W2', B: 'L2' })
  })

  it('orders games by week even when listed out of order, and counts ties', () => {
    const games = [game('g2', 2, 'A', 'B'), game('g1', 1, 'A', 'B')]
    const scores = new Map([
      ['g1', score(3, 0)],
      ['g2', score(7, 7)],
    ])
    expect(Object.fromEntries(streaks(games, scores))).toEqual({ A: 'T1', B: 'T1' })
  })

  it('skips games that are not final, voided, or have no score', () => {
    const games = [
      game('g1', 1, 'A', 'B', { status: 'scheduled' }),
      game('g2', 2, 'A', 'B', { voided_at: 'x' }),
      game('g3', 3, 'A', 'B'),
    ]
    const scores = new Map([
      ['g1', score(1, 0)],
      ['g2', score(1, 0)],
    ])
    expect(streaks(games, scores).size).toBe(0)
  })
})
