import { describe, expect, it } from 'vitest'
import type { Game } from '../../types/db'
import { gamePoints, opponentOf, pairByPosition, qbOf, teamWeek, weekGame, type WeekRow } from './week'

const game = (id: string, week: number, status: Game['status'], home = 'A', away = 'B', extra: Partial<Game> = {}): Game => ({
  id,
  season_id: 's',
  week,
  starts_at: `2026-11-${String(week).padStart(2, '0')}T15:00:00Z`,
  field: null,
  home_team_id: home,
  away_team_id: away,
  status,
  kind: 'regular',
  home_qb_id: null,
  away_qb_id: null,
  voided_at: null,
  ...extra,
})

describe('weekGame', () => {
  it('picks a game being played now first', () => {
    const games = [game('g1', 1, 'final'), game('g2', 2, 'halftime'), game('g3', 3, 'scheduled')]
    expect(weekGame('A', games)?.id).toBe('g2')
  })
  it('else the next scheduled game, else the latest final', () => {
    expect(weekGame('A', [game('g3', 3, 'scheduled'), game('g1', 1, 'final'), game('g2', 2, 'scheduled')])?.id).toBe('g2')
    expect(weekGame('B', [game('g1', 1, 'final'), game('g2', 2, 'final')])?.id).toBe('g2')
  })
  it('skips voided games, games without both teams, and other teams’ games', () => {
    const games = [game('g1', 1, 'scheduled', 'A', 'B', { voided_at: 'x' }), game('g2', 2, 'scheduled', 'A', 'B', { away_team_id: null }), game('g3', 3, 'scheduled', 'C', 'D')]
    expect(weekGame('A', games)).toBeNull()
  })
})

describe('opponentOf and qbOf', () => {
  it('read the other side and this side’s QB', () => {
    const g = game('g1', 1, 'live', 'A', 'B', { home_qb_id: 'maurice', away_qb_id: 'eddie' })
    expect(opponentOf(g, 'A')).toBe('B')
    expect(opponentOf(g, 'B')).toBe('A')
    expect(qbOf(g, 'A')).toBe('maurice')
    expect(qbOf(g, 'B')).toBe('eddie')
  })
})

const POINTS = new Map([
  ['rec', 1],
  ['td', 6],
  ['drop', -1],
  ['target', 0],
])

describe('gamePoints', () => {
  it('adds each player’s stats times their points, biggest first', () => {
    const scored = gamePoints(
      [
        { player_id: 'ann', stat_type_id: 'rec', value: 3 },
        { player_id: 'ann', stat_type_id: 'td', value: 1 },
        { player_id: 'ann', stat_type_id: 'drop', value: 1 },
        { player_id: 'ann', stat_type_id: 'target', value: 5 },
        { player_id: 'ann', stat_type_id: 'rec', value: 1 },
        { player_id: null, stat_type_id: 'td', value: 1 },
      ],
      POINTS,
    )
    expect(scored.get('ann')).toEqual({
      points: 9,
      lines: [
        { statTypeId: 'td', value: 1, points: 6 },
        { statTypeId: 'rec', value: 4, points: 4 },
        { statTypeId: 'drop', value: 1, points: -1 },
        { statTypeId: 'target', value: 5, points: 0 },
      ],
    })
    expect(scored.size).toBe(1)
  })
  it('drops a stat that adds up to zero (logged then taken back)', () => {
    const scored = gamePoints(
      [
        { player_id: 'bo', stat_type_id: 'td', value: 1 },
        { player_id: 'bo', stat_type_id: 'td', value: -1 },
      ],
      POINTS,
    )
    expect(scored.get('bo')).toEqual({ points: 0, lines: [] })
  })
})

describe('teamWeek', () => {
  const roster = [
    { id: 'ann', position: 'WR' },
    { id: 'bo', position: 'CB' },
    { id: 'cy', position: 'WR' },
  ]
  const projected = new Map([
    ['ann', 4],
    ['bo', 9],
    ['maurice', 12],
  ])

  it('puts the QB on top, then the roster by estimate; no actual points before kickoff', () => {
    const week = teamWeek({ roster, qbId: 'maurice', game: game('g1', 1, 'scheduled'), projected, scored: null })
    expect(week.rows.map((r) => [r.playerId, r.isQb, r.projected, r.actual])).toEqual([
      ['maurice', true, 12, null],
      ['bo', false, 9, null],
      ['ann', false, 4, null],
      ['cy', false, null, null],
    ])
    expect(week.projected).toBe(25)
    expect(week.actual).toBeNull()
  })

  it('counts actual points once the game starts, 0 for players with no stats', () => {
    const scored = gamePoints([{ player_id: 'ann', stat_type_id: 'td', value: 2 }], POINTS)
    const week = teamWeek({ roster, qbId: null, game: game('g1', 1, 'live'), projected, scored })
    expect(week.rows.map((r) => [r.playerId, r.actual])).toEqual([
      ['bo', 0],
      ['ann', 12],
      ['cy', 0],
    ])
    expect(week.actual).toBe(12)
    expect(week.rows[1]!.breakdown).toEqual([{ statTypeId: 'td', value: 2, points: 12 }])
  })

  it('does not list a QB twice when they are also on the roster', () => {
    const week = teamWeek({ roster, qbId: 'ann', game: null, projected, scored: null })
    expect(week.rows.map((r) => r.playerId)).toEqual(['ann', 'bo', 'cy'])
    expect(week.rows[0]!.position).toBe('QB')
  })
})

describe('pairByPosition', () => {
  const r = (playerId: string, position: string, isQb = false): WeekRow => ({ playerId, position, isQb, projected: null, actual: null, breakdown: [] })

  it('faces QB against QB, then the same positions, then whoever is left', () => {
    const home = [r('q1', 'QB', true), r('h1', 'WR'), r('h2', 'CB'), r('h3', 'LB')]
    const away = [r('q2', 'QB', true), r('a1', 'CB'), r('a2', 'WR'), r('a3', 'S'), r('a4', 'WR')]
    expect(pairByPosition(home, away).map(([h, a]) => [h?.playerId ?? null, a?.playerId ?? null])).toEqual([
      ['q1', 'q2'],
      ['h1', 'a2'],
      ['h2', 'a1'],
      ['h3', 'a3'],
      [null, 'a4'],
    ])
  })

  it('leaves one side empty when only one team has a QB', () => {
    expect(pairByPosition([r('q1', 'QB', true)], [])).toEqual([[r('q1', 'QB', true), null]])
  })
})
