/**
 * Sprint 89 — deterministic intent extraction regression tests (Alpha blockers).
 */
import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { mergeRequirements } from '../agent/memory'
import { emptyRequirements } from '../agent/types'

describe('Sprint 89 intent extraction — destinations', () => {
  it('extracts cities and countries from aliases', () => {
    expect(extractFromUserText('Trip to Paris from Riyadh').patch.destination).toBe('Paris')
    expect(extractFromUserText('Visit Turkey for 5 days').patch.destination).toBe('Istanbul')
    expect(extractFromUserText('Maldives honeymoon').patch.destination).toBe('Maldives')
    expect(extractFromUserText('أريد السفر إلى المغرب').patch.destination).toBe('Morocco')
  })

  it('does not treat budget fillers as destinations', () => {
    const cut = extractFromUserText('Change budget to only 1500 SAR')
    expect(cut.patch.destination).toBeUndefined()
    expect(cut.patch.budgetAmount).toBe(1500)
    expect(cut.patch.budgetCurrency).toBe('SAR')
  })

  it('does not treat date fragments as destinations', () => {
    const april = extractFromUserText('Change dates to April instead')
    expect(april.patch.destination).toBeUndefined()
    expect(april.patch.startDate).toBeTruthy()
  })

  it('keeps Japan when month is also present', () => {
    const result = extractFromUserText('I want to spend 5 days in Japan next April.')
    expect(result.patch.destination).toBe('Japan')
    expect(result.patch.durationDays).toBe(5)
    expect(result.patch.startDate).toBeTruthy()
  })
})

describe('Sprint 89 intent extraction — budget currency travelers hotel', () => {
  it('parses budget and currency with fillers', () => {
    expect(extractFromUserText('budget is only 12000 SAR').patch).toMatchObject({
      budgetAmount: 12000,
      budgetCurrency: 'SAR',
    })
    expect(extractFromUserText('under $3000').patch.budgetAmount).toBe(3000)
  })

  it('parses traveler counts and hotel class', () => {
    expect(extractFromUserText('4 adults to Bahrain').patch.travelers).toBe(4)
    expect(extractFromUserText('Family trip with 2 kids').patch.travelers).toBe(4)
    const luxury = extractFromUserText('Change hotel class to 5 star luxury in London')
    expect(luxury.patch.destination).toBe('London')
    expect(luxury.patch.hotelPreference).toMatch(/5_star|luxury|resort/i)
  })

  it('parses transportation and activities interests', () => {
    const result = extractFromUserText(
      'Trip to Paris with flights and hotels plus museums and food tours',
    )
    expect(result.patch.destination).toBe('Paris')
    expect(result.patch.interests?.length ?? 0).toBeGreaterThan(0)
  })
})

describe('Sprint 89 destination replace (no entity leak)', () => {
  it('replaces destination on change/instead cues', () => {
    const first = extractFromUserText(
      'Plan a trip to Paris for 5 days, 2 adults, budget 10000 SAR from Riyadh',
    )
    const base = mergeRequirements(emptyRequirements(), first.patch)
    expect(base.destination).toBe('Paris')

    const second = extractFromUserText('Actually change destination to Rome instead')
    expect(second.patch.destination).toBe('Rome')
    expect(second.flags?.replaceDestinations).toBe(true)

    const merged = mergeRequirements(base, second.patch, {
      replaceDestinations: second.flags?.replaceDestinations,
    })
    expect(merged.destination).toBe('Rome')
    expect(merged.destinations).toEqual(['Rome'])
  })

  it('still unions multi-city on first shot', () => {
    const multi = extractFromUserText(
      'I want to visit Paris and Rome in one trip for 10 days',
    )
    expect(multi.patch.destinations).toEqual(expect.arrayContaining(['Paris', 'Rome']))
  })
})
