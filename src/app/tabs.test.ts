import { describe, expect, it } from 'vitest'
import { activeTabIndex, parentTabIndex } from './tabs'

describe('parentTabIndex', () => {
  it('is the tab itself on a tab page', () => {
    expect(parentTabIndex('/schedule')).toBe(1)
    expect(parentTabIndex('/me')).toBe(3)
  })
  it('sends team sub-pages to Team', () => {
    expect(parentTabIndex('/matchup/abc')).toBe(0)
    expect(parentTabIndex('/players/abc')).toBe(0)
    expect(parentTabIndex('/game')).toBe(0)
  })
  it('sends the rulebook and dev tools to Me', () => {
    expect(parentTabIndex('/rules')).toBe(3)
    expect(parentTabIndex('/dev')).toBe(3)
  })
  it('falls back to Team for anything else', () => {
    expect(parentTabIndex('/nope')).toBe(0)
  })
  it('leaves activeTabIndex at -1 on sub-pages', () => {
    expect(activeTabIndex('/rules')).toBe(-1)
  })
})
