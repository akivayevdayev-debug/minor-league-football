import { describe, expect, it } from 'vitest'
import type { GamePoints } from '../mvp/race'
import { cell, seasonCounts, visibleColumns, weekCounts, TABLE_COLUMNS } from './table'
import type { WeekRow } from './week'

describe('TABLE_COLUMNS', () => {
  it('lists the stat columns in the fixed order', () => {
    expect(TABLE_COLUMNS.map((c) => c.key)).toEqual([
      'pass_td',
      'td',
      'rec',
      'int',
      'pick6',
      'sack',
      'block',
      'int_thrown',
      'rollout',
      'sack_taken',
      'sack_allowed',
    ])
  })
})

describe('weekCounts', () => {
  it('adds codes into their column', () => {
    const row: WeekRow = {
      playerId: 'p',
      isQb: false,
      position: 'WR',
      projected: 5,
      actual: 12,
      breakdown: [
        { statTypeId: 'td', value: 1, points: 6 },
        { statTypeId: 'rec_td', value: 1, points: 6 },
        { statTypeId: 'rec', value: 4, points: 0 },
      ],
    }
    expect(weekCounts(row)).toEqual({ td: 2, rec: 4 })
  })

  it('gives no counts before kickoff', () => {
    expect(
      weekCounts({ playerId: 'p', isQb: false, position: 'WR', projected: 5, actual: null, breakdown: [] }),
    ).toEqual({})
  })
})

describe('seasonCounts', () => {
  it('sums a season for one player only', () => {
    const games: GamePoints[] = [
      { player_id: 'p', game_id: 'g1', week: 1, points: 10, stats: { td: 1, rec: 3 } },
      { player_id: 'p', game_id: 'g2', week: 2, points: 4, stats: { sack: 2 } },
      { player_id: 'q', game_id: 'g1', week: 1, points: 99, stats: { td: 9 } },
    ]
    expect(seasonCounts(games, 'p')).toEqual({ games: 2, points: 14, counts: { td: 1, rec: 3, sack: 2 } })
  })

  it('gives zeros for a player with no games', () => {
    expect(seasonCounts([], 'p')).toEqual({ games: 0, points: 0, counts: {} })
  })
})

describe('visibleColumns', () => {
  it('hides columns that are zero for everyone and keeps the fixed order', () => {
    expect(visibleColumns([{ sack: 1 }, { td: 2, rec: 0 }]).map((c) => c.key)).toEqual(['td', 'sack'])
    expect(visibleColumns([{}, {}])).toEqual([])
  })
})

describe('cell', () => {
  it('shows a dash for zero or missing', () => {
    expect(cell({ td: 0 }, 'td')).toBe('–')
    expect(cell({}, 'rec')).toBe('–')
    expect(cell({ rec: 4 }, 'rec')).toBe('4')
  })
})
