import { describe, expect, it } from 'vitest'
import type { RosterMembership, Team } from '../../types/db'
import { currentTeams, formatHeight, joinHeight, readWholeNumber, splitHeight } from './derive'
import { seasonTeams } from './season'

describe('height boxes', () => {
  it("turns 5 ft 6 in into 66 inches", () => {
    expect(joinHeight('5', '6')).toBe(66)
  })
  it('keeps half inches', () => {
    expect(joinHeight('5', '5.5')).toBe(65.5)
    expect(formatHeight(65.5)).toBe('5′5.5″')
  })
  it('treats a blank inches box as 0', () => {
    expect(joinHeight('6', '')).toBe(72)
  })
  it('lets both boxes be blank (no height)', () => {
    expect(joinHeight('', '')).toBeNull()
  })
  it('refuses heights that are not real', () => {
    expect(joinHeight('5', '12')).toBeUndefined()
    expect(joinHeight('12', '0')).toBeUndefined()
    expect(joinHeight('5.5', '0')).toBeUndefined()
    expect(joinHeight('five', '6')).toBeUndefined()
    expect(joinHeight('5', '6.25')).toBeUndefined()
  })
  it('fills the boxes back from the stored height', () => {
    expect(splitHeight(66)).toEqual({ feet: '5', inches: '6' })
    expect(splitHeight(65.5)).toEqual({ feet: '5', inches: '5.5' })
    expect(splitHeight(null)).toEqual({ feet: '', inches: '' })
  })
})

describe('whole-number boxes (weight, birth year)', () => {
  it('reads a number in range', () => {
    expect(readWholeNumber(' 120 ', 50, 400)).toBe(120)
  })
  it('lets the box be blank', () => {
    expect(readWholeNumber('', 50, 400)).toBeNull()
  })
  it('refuses numbers out of range or with decimals', () => {
    expect(readWholeNumber('20', 50, 400)).toBeUndefined()
    expect(readWholeNumber('120.5', 50, 400)).toBeUndefined()
    expect(readWholeNumber('abc', 50, 400)).toBeUndefined()
  })
})

/*
 * Review Focus #5: Season 1 pages show exactly what they did before Season 2 existed.
 * Season 1 data is run through the same helpers before and after Season 2 teams, rosters and games are added.
 */
const team = (id: string, season_id: string, color_key: Team['color_key']): Team => ({
  id, name: id, short_name: id, color_key, logo_path: null, photo_path: null, season_id, captain_player_id: null, voided_at: null,
})
const line = (id: string, player_id: string, team_id: string, starts_on: string): RosterMembership => ({
  id, player_id, team_id, starts_on, ends_on: null, voided_at: null,
})

const season1Teams = [team('demons', 's1', 'demons'), team('daybies', 's1', 'daybies'), team('tigers', 's1', 'tigers')]
const season1Lines = [
  line('l1', 'p1', 'demons', '2026-10-04'),
  line('l2', 'p2', 'demons', '2026-10-04'),
  line('l3', 'p3', 'daybies', '2026-10-04'),
  line('l4', 'p4', 'tigers', '2026-10-04'),
]

const season2Teams = [team('gooners', 's2', 'gooners'), team('sucks', 's2', 'sucks')]
const season2Lines = [line('l5', 'p9', 'gooners', '2026-11-08'), line('l6', 'p10', 'sucks', '2026-11-08')]
const season2Games = [{ id: 'g1', season_id: 's2', home_team_id: 'gooners', away_team_id: 'sucks', status: 'scheduled' }]

/** A plain, stable form of the Season 1 view: player id → team id, sorted. */
const season1View = (teams: Team[], lines: RosterMembership[]) =>
  [...currentTeams(lines, seasonTeams(teams, 's1')).entries()]
    .map(([player, t]) => [player, t.id] as const)
    .sort(([a], [b]) => a.localeCompare(b))

describe('Season 1 view is unchanged by Season 2 data', () => {
  it('current Season 1 teams are identical after Season 2 teams, rosters and games are added', () => {
    const before = season1View(season1Teams, season1Lines)
    expect(before).toEqual([
      ['p1', 'demons'],
      ['p2', 'demons'],
      ['p3', 'daybies'],
      ['p4', 'tigers'],
    ])

    const after = season1View([...season1Teams, ...season2Teams], [...season1Lines, ...season2Lines])
    expect(after).toEqual(before)
    expect(season2Games.every((g) => g.season_id === 's2')).toBe(true)
  })

  it('Season 2 teams never leak into the Season 1 team list', () => {
    expect(seasonTeams([...season1Teams, ...season2Teams], 's1').map((t) => t.id)).toEqual(['demons', 'daybies', 'tigers'])
  })
})
