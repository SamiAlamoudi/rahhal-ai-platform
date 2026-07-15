import { describe, it, expect } from 'vitest'
import { selectToolsForTurn } from '../agent/tools/selectTools'
import { emptyRequirements } from '../agent/types'

describe('selectToolsForTurn', () => {
  it('selects no tools while requirements are incomplete', () => {
    expect(selectToolsForTurn({
      requirements: { ...emptyRequirements(), destination: 'Japan', destinations: ['Japan'] },
      intent: 'plan',
      missingFields: ['durationDays'],
    })).toEqual([])
  })

  it('auto-selects weather/attractions/flights/hotels/maps/visa for Japan planning', () => {
    const selected = selectToolsForTurn({
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        startDate: '2027-04-01',
        budgetAmount: 3000,
        budgetCurrency: 'USD',
      },
      intent: 'plan',
      missingFields: [],
    })
    expect(selected).toEqual(expect.arrayContaining([
      'weather',
      'attractions',
      'flights',
      'hotels',
      'maps',
      'visa',
      'currency',
      'transportation',
    ]))
  })

  it('skips tools on save intent', () => {
    expect(selectToolsForTurn({
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
      },
      intent: 'save',
      missingFields: [],
    })).toEqual([])
  })

  it('selects flights-focused tools for flights_only package', () => {
    const selected = selectToolsForTurn({
      requirements: {
        ...emptyRequirements(),
        destination: 'Japan',
        destinations: ['Japan'],
        durationDays: 5,
        packageScope: 'flights_only',
      },
      intent: 'plan',
      missingFields: [],
    })
    expect(selected).toEqual(expect.arrayContaining(['flights', 'weather', 'maps', 'visa']))
    expect(selected).not.toContain('hotels')
    expect(selected).not.toContain('attractions')
  })

  it('scopes tools for flight / hotel / activities / day regeneration', () => {
    const base = {
      ...emptyRequirements(),
      destination: 'Japan',
      destinations: ['Japan'],
      durationDays: 5,
    }
    expect(selectToolsForTurn({
      requirements: { ...base, regenerateScope: 'flight' },
      intent: 'regenerate',
      missingFields: [],
    })).toEqual(['flights'])
    expect(selectToolsForTurn({
      requirements: { ...base, regenerateScope: 'hotel' },
      intent: 'regenerate',
      missingFields: [],
    })).toEqual(['hotels'])
    expect(selectToolsForTurn({
      requirements: { ...base, regenerateScope: 'activities' },
      intent: 'regenerate',
      missingFields: [],
    })).toEqual(['weather', 'attractions', 'maps'])
    expect(selectToolsForTurn({
      requirements: { ...base, regenerateScope: 'day', regenerateDay: 2 },
      intent: 'regenerate_day',
      missingFields: [],
    })).toEqual(['weather', 'attractions'])
  })
})
