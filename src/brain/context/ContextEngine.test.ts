import { describe, expect, it } from 'vitest'
import { createEmptyShortTerm } from '../memory'
import { ContextEngine } from './ContextEngine'

describe('ContextEngine', () => {
  const ctx = new ContextEngine()

  it('resolves EN/AR references', () => {
    const stm = createEmptyShortTerm()
    stm.lastMentionedOptions = ['fl-a', 'fl-b', 'ht-x']
    const draft = { destination: 'Istanbul' }
    const refs = ctx.resolve(
      'same hotel next week cheaper option first one second flight there',
      stm,
      draft,
    )
    expect(refs.some((r) => r.kind === 'hotel')).toBe(true)
    expect(refs.some((r) => r.kind === 'date' && r.value === 'next_week')).toBe(true)
    expect(refs.some((r) => r.kind === 'price')).toBe(true)
    expect(refs.some((r) => r.kind === 'option_index')).toBe(true)
    expect(refs.some((r) => r.kind === 'flight')).toBe(true)
    expect(refs.some((r) => r.kind === 'destination' && r.value === 'Istanbul')).toBe(true)
  })

  it('handles unresolved destination and applies resolutions', () => {
    const stm = createEmptyShortTerm()
    const refs = ctx.resolve('go there', stm, {})
    expect(refs[0]?.confidence).toBeLessThan(0.5)
    const applied = ctx.applyResolutions({}, [
      { phrase: 'there', kind: 'destination', value: 'Dubai', confidence: 0.9 },
      { phrase: 'next week', kind: 'date', value: 'next_week', confidence: 0.9 },
    ])
    expect(applied.destination).toBe('Dubai')
    expect(applied.departureDate).toBe('RELATIVE:next_week')
    const remembered = ctx.rememberOptions(stm, ['fl-1', 'fl-2'])
    expect(remembered.lastMentionedOptions).toEqual(['fl-1', 'fl-2'])
  })

  it('resolves Arabic references', () => {
    const refs = ctx.resolve('نفس الفندق الأسبوع القادم أرخص', createEmptyShortTerm(), {
      destination: 'Cairo',
    })
    expect(refs.length).toBeGreaterThan(1)
  })
})
