/**
 * Sprint 47 — Cold destination discovery expansion tests.
 */
import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { mergeRequirements } from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import {
  DESTINATION_CATALOG,
  findDestinationProfile,
  runTravelReasoning,
} from '../agent/reasoning'

const COLD_IDS = new Set([
  'switzerland',
  'austria',
  'norway',
  'canada',
  'new-zealand',
  'sapporo',
  'iceland',
  'geneva',
  'tokyo',
])

describe('Sprint 47 cold destination catalog', () => {
  it('includes mission cold destinations', () => {
    const ids = DESTINATION_CATALOG.map((row) => row.id)
    expect(ids).toEqual(expect.arrayContaining([
      'switzerland',
      'austria',
      'norway',
      'canada',
      'new-zealand',
      'sapporo',
      'iceland',
    ]))
  })

  it('resolves country aliases to catalog profiles', () => {
    expect(findDestinationProfile('Japan')?.id).toBe('tokyo')
    expect(findDestinationProfile('Switzerland')?.id).toBe('switzerland')
    expect(findDestinationProfile('Queenstown')?.id).toBe('new-zealand')
    expect(findDestinationProfile('النرويج')?.id).toBe('norway')
  })

  it('extracts new cold destinations from user text', () => {
    expect(extractFromUserText('Trip to Switzerland').patch.destination).toBe('Switzerland')
    expect(extractFromUserText('Travel to Norway').patch.destination).toBe('Norway')
    expect(extractFromUserText('أريد السفر إلى كندا').patch.destination).toBe('Canada')
  })

  it('recommends cold destinations for a January cold ask', () => {
    const requirements = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cold',
      budgetAmount: 20000,
      budgetCurrency: 'SAR',
      startDate: '2027-01-10',
      durationDays: 7,
      travelers: 2,
    })
    const result = runTravelReasoning({
      locale: 'en',
      requirements,
      userText: 'I want somewhere cold in January',
      now: new Date('2026-12-01T00:00:00Z'),
      maxResults: 5,
    })
    const top = [result.primary!, ...result.alternatives].map((row) => row.id)
    expect(top.some((id) => COLD_IDS.has(id))).toBe(true)
    expect(top.join(',')).toMatch(/switzerland|norway|austria|iceland|sapporo|canada|geneva|tokyo/)
    expect(top).not.toContain('dubai')
    expect(top).not.toContain('maldives')
    expect(result.primary?.whySelected.join(' ').toLowerCase()).toMatch(/climate|cool|cold|طقس|بارد/)
  })

  it('recommends New Zealand for cold weather in southern winter (August)', () => {
    const requirements = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cold',
      budgetAmount: 25000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-05',
      durationDays: 8,
      travelers: 2,
    })
    const result = runTravelReasoning({
      locale: 'en',
      requirements,
      userText: 'somewhere cold next month',
      now: new Date('2026-07-20T00:00:00Z'),
    })
    const top = [result.primary!, ...result.alternatives].map((row) => row.id)
    expect(top).toContain('new-zealand')
    expect(top).not.toContain('dubai')
  })
})
