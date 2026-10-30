import { describe, expect, it } from 'vitest'
import { formatHeight, joinHeight, readWholeNumber, splitHeight } from './derive'

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
