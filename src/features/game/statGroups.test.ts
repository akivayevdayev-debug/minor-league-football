import { describe, expect, it } from 'vitest'
import { groupsFor, limitMessage, statTimeLabel } from './statGroups'

describe('which stat groups a player sees on the pad', () => {
  it('a QB sees the QB group, then defense and kicks', () => {
    expect(groupsFor(['WR'], true)).toEqual(['qb', 'defense', 'kicks'])
  })
  it('OL/TE see receiving and line', () => {
    expect(groupsFor(['OL/TE'], false)).toEqual(['receiving', 'line', 'defense', 'kicks'])
  })
  it('WR sees receiving; DL sees defense', () => {
    expect(groupsFor(['WR'], false)).toEqual(['receiving', 'defense', 'kicks'])
    expect(groupsFor(['DL'], false)).toEqual(['defense', 'kicks'])
  })
  it('removes duplicates when several positions share a group', () => {
    expect(groupsFor(['OL/TE', 'DL', 'TE'], false)).toEqual(['receiving', 'line', 'defense', 'kicks'])
  })
  it('a player with no positions still sees defense and kicks', () => {
    expect(groupsFor([], false)).toEqual(['defense', 'kicks'])
  })
})

describe('the game time shown on a stat line', () => {
  it('shows half and time left in the half', () => {
    expect(statTimeLabel(2, 252)).toBe('2nd · 4:12')
    expect(statTimeLabel(1, 0)).toBe('1st · 0:00')
  })
  it('shows overtime as OT', () => {
    expect(statTimeLabel(3, 30)).toBe('OT · 0:30')
  })
  it('shows nothing when the time was not recorded', () => {
    expect(statTimeLabel(1, null)).toBeNull()
    expect(statTimeLabel(null, 30)).toBeNull()
  })
})

describe('the per-game limit message', () => {
  it('turns the database limit error into a friendly line', () => {
    expect(limitMessage('MLF_LIMIT:Receptions:40')).toBe("That's more than 40 Receptions for one game. Check the number.")
  })
  it('keeps colons inside the label', () => {
    expect(limitMessage('MLF_LIMIT:Score lines:30')).toBe("That's more than 30 Score lines for one game. Check the number.")
  })
  it('leaves other errors alone', () => {
    expect(limitMessage('A total cannot go below 0.')).toBeNull()
  })
})
