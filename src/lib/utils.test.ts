import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('keeps a text colour next to one of our custom text sizes', () => {
    expect(cn('bg-primary text-primary-ink text-body').split(' ')).toEqual(['bg-primary', 'text-primary-ink', 'text-body'])
  })
  it('still lets a later size replace an earlier one', () => {
    expect(cn('text-body', 'text-small')).toBe('text-small')
  })
  it('still lets a later colour replace an earlier one', () => {
    expect(cn('text-text', 'text-text-2')).toBe('text-text-2')
  })
})
