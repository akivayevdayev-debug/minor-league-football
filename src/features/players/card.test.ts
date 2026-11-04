import { describe, expect, it } from 'vitest'
import { cardTotals, gameLine, nextAsQb, opponentIn, recentGames, type LogGame } from './card'

const g = (id: string, season: string, week: number, points: number, stats: Record<string, number> = {}, extra: Partial<LogGame> = {}): LogGame => ({
  game_id: id,
  season_id: season,
  week,
  starts_at: `2026-0${week}-01T18:00:00Z`,
  points,
  stats,
  home_team_id: 'A',
  away_team_id: 'B',
  ...extra,
})

describe('cardTotals', () => {
  const log = [g('1', 's1', 1, 10, { td: 1, rec: 4 }), g('2', 's1', 2, 6, { td: 1 }), g('3', 's2', 1, 3, { rec: 3 })]

  it('adds up one season', () => {
    expect(cardTotals(log, 's1')).toEqual({ games: 2, points: 16, perGame: 8, stats: { td: 2, rec: 4 } })
  })

  it('adds up the whole career', () => {
    expect(cardTotals(log, null)).toMatchObject({ games: 3, points: 19, stats: { td: 2, rec: 7 } })
  })

  it('has no per-game average with no games', () => {
    expect(cardTotals(log, 'none')).toEqual({ games: 0, points: 0, perGame: null, stats: {} })
  })
})

describe('recentGames', () => {
  it('puts the newest first and keeps at most n', () => {
    const log = [1, 2, 3, 4, 5].map((w) => g(String(w), 's', w, w))
    expect(recentGames(log, null, 3).map((x) => x.game_id)).toEqual(['5', '4', '3'])
  })

  it('keeps to one season when asked', () => {
    const log = [g('1', 's1', 1, 0), g('2', 's2', 2, 0)]
    expect(recentGames(log, 's1').map((x) => x.game_id)).toEqual(['1'])
  })
})

describe('opponentIn', () => {
  it('uses the team the player was on that day', () => {
    const history = [
      { team_id: 'A', starts_on: '2026-01-01', ends_on: '2026-03-01' },
      { team_id: 'B', starts_on: '2026-03-01', ends_on: null },
    ]
    expect(opponentIn({ home_team_id: 'A', away_team_id: 'B', starts_at: '2026-02-01T18:00:00Z' }, history)).toBe('B')
    expect(opponentIn({ home_team_id: 'A', away_team_id: 'B', starts_at: '2026-04-01T18:00:00Z' }, history)).toBe('A')
  })

  it('falls back to the only team of the two they ever played for', () => {
    expect(opponentIn({ home_team_id: 'A', away_team_id: 'C', starts_at: null }, [{ team_id: 'C', starts_on: '2027-01-01', ends_on: null }])).toBe('A')
  })

  it('gives null when it cannot tell', () => {
    expect(opponentIn({ home_team_id: 'A', away_team_id: 'B', starts_at: null }, [])).toBeNull()
    expect(opponentIn({ home_team_id: null, away_team_id: 'B', starts_at: null }, [])).toBeNull()
  })
})

describe('gameLine', () => {
  it('lists up to three stats, most telling first', () => {
    expect(gameLine({ rec: 5, td: 2, drop: 1, int: 1 })).toBe('2 TD · 5 Rec · 1 INT')
  })

  it('is empty with nothing worth a mention', () => {
    expect(gameLine({ target: 4 })).toBe('')
  })
})

describe('nextAsQb', () => {
  const game = (id: string, week: number, status: string, qb: string | null, voided_at: string | null = null) => ({
    id,
    week,
    status,
    starts_at: null,
    voided_at,
    home_qb_id: qb,
    away_qb_id: null,
  })

  it('picks the earliest scheduled game they throw in', () => {
    const games = [game('3', 3, 'scheduled', 'Q'), game('1', 1, 'final', 'Q'), game('2', 2, 'scheduled', 'Q'), game('x', 1, 'scheduled', 'other')]
    expect(nextAsQb(games, 'Q')?.id).toBe('2')
  })

  it('prefers a game being played now and skips voided games', () => {
    expect(nextAsQb([game('2', 2, 'scheduled', 'Q'), game('1', 1, 'halftime', 'Q')], 'Q')?.id).toBe('1')
    expect(nextAsQb([game('1', 1, 'scheduled', 'Q', 'x')], 'Q')).toBeNull()
  })
})
