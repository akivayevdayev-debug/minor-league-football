import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activeTabIndex, parentTabIndex, rememberTab, startingTab } from './tabs'

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


function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

describe('startingTab', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))

  it('uses the tab you were last on for a player page', () => {
    rememberTab(3)
    expect(startingTab('/players/abc')).toBe(3)
  })
  it('keeps fixed homes for rules and dev tools', () => {
    rememberTab(0)
    expect(startingTab('/rules')).toBe(3)
  })
  it('falls back to Team with nothing saved', () => {
    expect(startingTab('/players/abc')).toBe(0)
  })
  it('ignores a broken saved value', () => {
    localStorage.setItem('mlf-last-tab', 'nope')
    expect(startingTab('/matchup/x')).toBe(0)
  })
})
