import { describe, expect, it } from 'vitest'
import { describeStats, gamesNeeded, mvpRace, playersOfTheWeek, type FinalGame, type GamePoints } from './race'

const game = (id: string, week: number, home: string, away: string): FinalGame => ({ id, week, home_team_id: home, away_team_id: away })
const pts = (player_id: string, game_id: string, week: number, points: number, stats: Record<string, number> = {}): GamePoints => ({
  player_id,
  game_id,
  week,
  points,
  stats,
})

// Week 1: A v B, C v D. Week 2: A v C, B v D.
const GAMES = [game('g1', 1, 'A', 'B'), game('g2', 1, 'C', 'D'), game('g3', 2, 'A', 'C'), game('g4', 2, 'B', 'D')]
const TEAM = new Map([
  ['ann', 'A'],
  ['bo', 'B'],
  ['cy', 'C'],
  ['dee', 'D'],
])
const labels = new Map([['block', 'Blocks']])

describe('gamesNeeded', () => {
  it('is half the team’s final games, rounded up, at least 1', () => {
    expect(gamesNeeded('A', GAMES)).toBe(1)
    expect(gamesNeeded('A', [...GAMES, game('g5', 3, 'A', 'D')])).toBe(2)
    expect(gamesNeeded('A', [])).toBe(1)
  })
  it('measures a QB (no team) against the Sundays played', () => {
    expect(gamesNeeded(undefined, GAMES)).toBe(1)
    expect(gamesNeeded(undefined, [...GAMES, game('g5', 3, 'A', 'D')])).toBe(2)
  })
})

describe('mvpRace', () => {
  const points = [
    pts('ann', 'g1', 1, 10),
    pts('ann', 'g3', 2, 2), // 6 per game
    pts('bo', 'g1', 1, 8),
    pts('bo', 'g4', 2, 8), // 8 per game
    pts('cy', 'g2', 1, 3),
    pts('cy', 'g3', 2, 3), // 3 per game
  ]

  it('ranks by points per game, not total', () => {
    const race = mvpRace({ points, finalGames: GAMES, teamOf: TEAM, pins: [] })
    expect(race.ranked.map((r) => [r.playerId, r.place, r.perGame])).toEqual([
      ['bo', 1, 8],
      ['ann', 2, 6],
      ['cy', 3, 3],
    ])
    expect(race.week).toBe(2)
  })

  it('shows how far each player moved since last week', () => {
    // After week 1: ann 10, bo 8, cy 3. Now: bo, ann, cy.
    const race = mvpRace({ points, finalGames: GAMES, teamOf: TEAM, pins: [] })
    expect(Object.fromEntries(race.ranked.map((r) => [r.playerId, r.moved]))).toEqual({ bo: 1, ann: -1, cy: 0 })
  })

  it('has no movement in the first week', () => {
    const race = mvpRace({ points: points.filter((p) => p.week === 1), finalGames: GAMES.slice(0, 2), teamOf: TEAM, pins: [] })
    expect(race.ranked.every((r) => r.moved === null)).toBe(true)
  })

  it('keeps a player with too few games out of the ranking until they have enough', () => {
    const more = [...GAMES, game('g5', 3, 'A', 'D'), game('g6', 3, 'B', 'C')] // every team: 3 games → 2 needed
    const race = mvpRace({ points: [...points, pts('dee', 'g4', 2, 30)], finalGames: more, teamOf: TEAM, pins: [] })
    expect(race.ranked.map((r) => r.playerId)).not.toContain('dee')
    expect(race.waiting).toEqual([{ playerId: 'dee', points: 30, games: 1, needed: 2 }])
  })

  it('puts a pinned player at the pinned place and shifts the others', () => {
    const race = mvpRace({ points, finalGames: GAMES, teamOf: TEAM, pins: [{ player_id: 'cy', place: 1, pinned_by: 'eddie' }] })
    expect(race.ranked.map((r) => [r.playerId, r.place, r.pinnedBy])).toEqual([
      ['cy', 1, 'eddie'],
      ['bo', 2, null],
      ['ann', 3, null],
    ])
  })

  it('ranks a pinned player even without enough games, and puts a pin past the end at the bottom', () => {
    const race = mvpRace({ points, finalGames: GAMES, teamOf: TEAM, pins: [{ player_id: 'dee', place: 9, pinned_by: 'akiva' }] })
    expect(race.ranked.map((r) => [r.playerId, r.place])).toEqual([
      ['bo', 1],
      ['ann', 2],
      ['cy', 3],
      ['dee', 4],
    ])
    expect(race.waiting).toEqual([])
  })

  it('is empty before any final game', () => {
    expect(mvpRace({ points: [], finalGames: [], teamOf: TEAM, pins: [] })).toEqual({ ranked: [], waiting: [], week: null })
  })
})

describe('playersOfTheWeek', () => {
  it('names the top scorer of each week, newest first, with a reason', () => {
    const stars = playersOfTheWeek(
      [pts('ann', 'g1', 1, 15, { td: 2, rec: 3 }), pts('bo', 'g1', 1, 8, { rec: 8 }), pts('cy', 'g3', 2, 4, { int: 1, rec: 1 })],
      labels,
    )
    expect(stars).toEqual([
      { playerId: 'cy', week: 2, points: 4, reason: '1 pick, 1 catch' },
      { playerId: 'ann', week: 1, points: 15, reason: '2 TDs, 3 catches' },
    ])
  })

  it('breaks a tie on touchdowns, and skips a week where nobody scored', () => {
    const stars = playersOfTheWeek([pts('ann', 'g1', 1, 6, { rec: 6 }), pts('bo', 'g1', 1, 6, { td: 1 }), pts('cy', 'g3', 2, 0)], labels)
    expect(stars.map((s) => s.playerId)).toEqual(['bo'])
  })
})

describe('describeStats', () => {
  it('lists at most three good stats, best first, and leaves out bad ones', () => {
    expect(describeStats({ drop: 2, rec: 4, td: 1, int: 2, block: 5 }, labels)).toBe('1 TD, 2 picks, 4 catches')
    expect(describeStats({ block: 1 }, labels)).toBe('1 block')
    expect(describeStats({ drop: 3 }, labels)).toBe('')
  })
})
