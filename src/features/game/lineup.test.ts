import { describe, expect, it } from 'vitest'
import { currentLineup, elapsedAt, minutesText, playingTime, type Lineup } from './lineup'

const H = 600 // 10-minute halves
let n = 0
const row = (team_id: string, on_field: string[], half: number, clock_seconds: number): Lineup => ({
  id: `l${n}`, game_id: 'g', team_id, on_field, half, clock_seconds, created_at: `2026-10-30T00:00:${String(n++).padStart(2, '0')}Z`,
})

describe('lineups and playing time', () => {
  it('counts game time across both halves', () => {
    expect(elapsedAt(1, 600, H)).toBe(0)
    expect(elapsedAt(1, 0, H)).toBe(600)
    expect(elapsedAt(2, 450, H)).toBe(750)
  })

  it('gives each player the time they were on the field, carrying the lineup into the 2nd half', () => {
    const lineups = [
      row('t', ['a', 'b'], 1, 600), // kickoff: c sits
      row('t', ['a', 'c'], 1, 300), // 5:00 left: c in for b
      row('t', ['b', 'c'], 2, 400), // 2nd half, 6:40 left: b in for a
    ]
    const t = playingTime(lineups, H, 1200) // full game
    expect(t.get('a')).toBe(800) // 600 + 200
    expect(t.get('b')).toBe(300 + 400)
    expect(t.get('c')).toBe(300 + 200 + 400)
  })

  it('stops counting at the current clock while the game is going', () => {
    const t = playingTime([row('t', ['a', 'b'], 1, 600)], H, 90)
    expect(t.get('a')).toBe(90)
  })

  it('keeps teams apart and finds who is on now', () => {
    const lineups = [row('x', ['a', 'b'], 1, 600), row('y', ['d', 'e'], 1, 600), row('x', ['b', 'c'], 1, 500)]
    expect(currentLineup(lineups, 'x', H)).toEqual(['b', 'c'])
    expect(currentLineup(lineups, 'y', H)).toEqual(['d', 'e'])
    expect(currentLineup(lineups, 'z', H)).toBeNull()
    expect(playingTime(lineups, H, 1200).get('d')).toBe(1200)
  })

  it('shows minutes as m:ss', () => {
    expect(minutesText(805)).toBe('13:25')
    expect(minutesText(59)).toBe('0:59')
  })
})

describe('minutes across games', () => {
  it('adds up a player over every game they were on the field, using each game clock', async () => {
    const { playerMinutes } = await import('./lineup')
    const g1 = { ...row('t', ['a', 'b'], 1, 600), game_id: 'g1' }
    const g2 = { ...row('t', ['b', 'c'], 1, 600), game_id: 'g2' }
    const g2sub = { ...row('t', ['a', 'c'], 1, 300), game_id: 'g2' }
    const clocks = [
      { game_id: 'g1', running: false, seconds_left: 0, started_at: null, half: 2 as const },
      { game_id: 'g2', running: false, seconds_left: 600, started_at: null, half: 2 as const }, // at halftime
    ]
    const m = playerMinutes([g1, g2, g2sub], clocks, 'a', H, 0)
    expect(m.seconds).toBe(1200 + 300)
    expect(m.gameIds.sort()).toEqual(['g1', 'g2'])
  })
})

describe('minutes only from kickoff', () => {
  it('counts a lineup saved at kickoff, not one first saved late in the game', async () => {
    const { trackedFromKickoff } = await import('./lineup')
    expect(trackedFromKickoff([row('t', ['a', 'b'], 1, 600)], 't', H)).toBe(true)
    expect(trackedFromKickoff([row('t', ['a', 'b'], 2, 49)], 't', H)).toBe(false)
    expect(trackedFromKickoff([row('t', ['a', 'b'], 1, 600)], 'other', H)).toBe(false)
  })
})
