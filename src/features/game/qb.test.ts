import { describe, expect, it } from 'vitest'
import type { Game, Player } from '../../types/db'
import { lastQbFor, qbCandidates } from './qb'

const game = (over: Partial<Game>): Game => ({
  id: 'g', season_id: 's2', week: 1, starts_at: null, field: null, home_team_id: 'A', away_team_id: 'B',
  status: 'final', kind: 'regular', home_qb_id: null, away_qb_id: null, voided_at: null, ...over,
})

const player = (id: string, login_name: string | null, voided_at: string | null = null): Player =>
  ({ id, full_name: id, nickname: null, login_name, jersey: null, positions: [], birth_year: null, height_in: null, weight_lb: null, photo_path: null, achievements: '', is_guest: false, voided_at })

describe('quarterbacks', () => {
  it('finds the league QBs by login: Maurice first, then Eddie, never voided ones', () => {
    const list = [player('e', 'eddie'), player('x', 'lee'), player('m', 'maurice'), player('old', 'eddie', '2026-01-01')]
    expect(qbCandidates(list).map((p) => p.id)).toEqual(['m', 'e'])
  })

  it("returns the QB from the team's most recent game when the team was home", () => {
    const games = [
      game({ id: 'old', starts_at: '2026-11-08T12:15:00Z', home_qb_id: 'maurice' }),
      game({ id: 'new', starts_at: '2026-11-15T12:15:00Z', home_qb_id: 'eddie', away_qb_id: 'maurice' }),
    ]
    expect(lastQbFor('A', games)).toBe('eddie')
  })

  it('uses the away side when the team played away in its most recent game', () => {
    const games = [
      game({ id: 'old', starts_at: '2026-11-08T12:15:00Z', home_team_id: 'A', away_team_id: 'C', home_qb_id: 'eddie' }),
      game({ id: 'new', starts_at: '2026-11-15T12:15:00Z', home_team_id: 'C', away_team_id: 'B', home_qb_id: 'maurice', away_qb_id: 'eddie' }),
    ]
    expect(lastQbFor('B', games)).toBe('eddie')
  })

  it('ignores games that have not started yet, games with no QB set, and other teams', () => {
    const games = [
      game({ id: 'future', status: 'scheduled', starts_at: '2026-12-01T12:15:00Z', home_qb_id: 'eddie' }),
      game({ id: 'noqb', starts_at: '2026-11-20T12:15:00Z', home_qb_id: null }),
      game({ id: 'other', starts_at: '2026-11-21T12:15:00Z', home_team_id: 'C', away_team_id: 'D', home_qb_id: 'eddie' }),
      game({ id: 'played', starts_at: '2026-11-08T12:15:00Z', home_qb_id: 'maurice' }),
    ]
    expect(lastQbFor('A', games)).toBe('maurice')
  })

  it('returns null when the team has no earlier game with a QB', () => {
    expect(lastQbFor('A', [])).toBeNull()
    expect(lastQbFor('A', [game({ home_qb_id: null })])).toBeNull()
  })
})
