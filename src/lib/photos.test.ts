import { describe, expect, it } from 'vitest'
import { fitWithin, photoPath } from './photos'

const ID = '11111111-2222-3333-4444-555555555555'
const FILE = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('photoPath', () => {
  it('puts player photos in the player folder', () => {
    expect(photoPath('player', ID, 'webp', FILE)).toBe(`players/${ID}/${FILE}.webp`)
  })
  it('keeps team logos and team photos apart', () => {
    expect(photoPath('logo', ID, 'jpg', FILE)).toBe(`teams/${ID}/logo-${FILE}.jpg`)
    expect(photoPath('team-photo', ID, 'webp', FILE)).toBe(`teams/${ID}/photo-${FILE}.webp`)
  })
  it('gives every upload a new name, so nothing is overwritten', () => {
    expect(photoPath('player', ID, 'webp')).not.toBe(photoPath('player', ID, 'webp'))
  })
})

describe('fitWithin', () => {
  it('shrinks a big phone photo to the longest side', () => {
    expect(fitWithin(4032, 3024, 1200)).toEqual({ width: 1200, height: 900 })
    expect(fitWithin(3024, 4032, 1200)).toEqual({ width: 900, height: 1200 })
  })
  it('never enlarges a small image', () => {
    expect(fitWithin(300, 200, 1200)).toEqual({ width: 300, height: 200 })
  })
})
