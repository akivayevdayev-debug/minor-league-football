import { describe, expect, it } from 'vitest'
import type { GameSub, Player } from '../../types/db'
import { playerMinutes, type Lineup } from './lineup'
import { teamListWithSubs, withTypedMinutes } from './subs'

const pl = (id: string, is_guest = false) => ({ id, is_guest, full_name: id }) as Player
const sub = (player_id: string, voided = false) =>
  ({ id: `s-${player_id}`, game_id: 'g1', team_id: 't', player_id, voided_at: voided ? '2026-11-03T10:00:00Z' : null, created_at: '2026-11-03T09:00:00Z' }) as GameSub

describe('team list with subs', () => {
  const roster = [pl('a'), pl('b', true)]
  const everyone = [pl('a'), pl('b', true), pl('x'), pl('y'), pl('z')]

  it('lists a sub who has no stats yet', () => {
    const list = teamListWithSubs(roster, [sub('x')], [], everyone)
    expect(list.map((r) => [r.p.id, r.sub])).toEqual([['a', false], ['b', true], ['x', true]])
  })

  it('leaves out a voided sub with no stats', () => {
    const list = teamListWithSubs(roster, [sub('x', true)], [], everyone)
    expect(list.map((r) => r.p.id)).toEqual(['a', 'b'])
  })

  it('still lists a player who has stat lines for the team, and does not repeat anyone', () => {
    const list = teamListWithSubs(roster, [sub('a'), sub('y')], ['y', 'z', 'a'], everyone)
    expect(list.map((r) => r.p.id)).toEqual(['a', 'b', 'y', 'z'])
    expect(list.find((r) => r.p.id === 'z')?.sub).toBe(true)
  })
})

describe('typed minutes', () => {
  it('replaces the tracked minutes for that player', () => {
    const tracked = new Map([['a', 600], ['b', 300]])
    const merged = withTypedMinutes(tracked, new Map([['a', 7.5]]))
    expect(merged.get('a')).toBe(450)
    expect(merged.get('b')).toBe(300)
  })

  it('counts a typed game in a player total, in place of the tracked time for that game', () => {
    const row = (team_id: string, game_id: string, on_field: string[], half: number, clock_seconds: number, n: number): Lineup => ({
      id: `l${n}`, game_id, team_id, on_field, half, clock_seconds, created_at: `2026-11-03T00:00:${String(n).padStart(2, '0')}Z`,
    })
    const lineups = [row('t', 'g1', ['a', 'b'], 1, 600, 1), row('t', 'g2', ['a', 'c'], 1, 600, 2)]
    const clocks = [
      { game_id: 'g1', running: false, seconds_left: 0, started_at: null, half: 2 as const },
      { game_id: 'g2', running: false, seconds_left: 0, started_at: null, half: 2 as const },
    ]
    const tracked = playerMinutes(lineups, clocks, 'a', 600, 0)
    expect(tracked.seconds).toBe(2400)
    const typed = playerMinutes(lineups, clocks, 'a', 600, 0, new Map([['g1', 5]]))
    expect(typed.seconds).toBe(300 + 1200)
    expect(typed.gameIds.sort()).toEqual(['g1', 'g2'])
  })
})
