import { describe, expect, it } from 'vitest'
import type { Season, Team } from '../../types/db'
import { activeSeason, pickViewedSeason, seasonRules, selectableSeasons, seasonTeams } from './season'

const base = { games_planned: null, voided_at: null, counts_for_standings: true }

const season1: Season = {
  ...base,
  id: 's1',
  name: 'Season 1',
  status: 'finished',
  starts_on: '2026-10-04',
  half_minutes: 10,
  halftime_minutes: 7,
  overtime_minutes: null,
  on_field: 2,
}

const season2: Season = {
  ...base,
  id: 's2',
  name: 'Season 2',
  status: 'regular',
  starts_on: '2026-11-08',
  half_minutes: 12,
  halftime_minutes: 7,
  overtime_minutes: 8,
  on_field: 3,
}

const earlier: Season = {
  ...base,
  id: 'e',
  name: 'Earlier totals',
  status: 'finished',
  starts_on: null,
  half_minutes: null,
  halftime_minutes: null,
  overtime_minutes: null,
  on_field: null,
  counts_for_standings: false,
}

const team = (id: string, season_id: string): Team => ({
  id,
  name: id,
  short_name: id,
  color_key: 'demons',
  logo_path: null,
  photo_path: null,
  season_id,
  captain_player_id: null,
  voided_at: null,
})

describe('seasonRules', () => {
  it('reads Season 2 rules from the season row', () => {
    expect(seasonRules(season2)).toEqual({ halfSeconds: 720, halftimeSeconds: 420, overtimeSeconds: 480, onField: 3 })
  })

  it('reads Season 1 rules from the season row, with no overtime', () => {
    expect(seasonRules(season1)).toEqual({ halfSeconds: 600, halftimeSeconds: 420, overtimeSeconds: null, onField: 2 })
  })
})

describe('which season is active and which can be picked', () => {
  it('the active season is the one that is not finished', () => {
    expect(activeSeason([season1, season2])?.id).toBe('s2')
  })

  it('there is no active season when all are finished', () => {
    expect(activeSeason([season1])).toBeUndefined()
  })

  it('offers only seasons that count for standings, newest first', () => {
    expect(selectableSeasons([earlier, season1, season2]).map((s) => s.id)).toEqual(['s2', 's1'])
  })

  it('falls back to the active season when the asked-for id is missing or unknown', () => {
    expect(pickViewedSeason([season1, season2], 's1')?.id).toBe('s1')
    expect(pickViewedSeason([season1, season2], 'nope')?.id).toBe('s2')
    expect(pickViewedSeason([season1, season2], null)?.id).toBe('s2')
  })
})

describe('teams per season', () => {
  it('keeps only the teams of the season asked for', () => {
    const teams = [team('a', 's1'), team('b', 's2'), team('c', 's1')]
    expect(seasonTeams(teams, 's1').map((t) => t.id)).toEqual(['a', 'c'])
  })
})
