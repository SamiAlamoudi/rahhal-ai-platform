import { describe, expect, it } from 'vitest'
import { buildTravelFacts } from '../agent/conversationBrain/travelFacts'
import { emptyMemory, emptyRequirements } from '../agent/types'

describe('travel facts — no repeated questions', () => {
  it('strips known duration/budget/destination from missingSlots', () => {
    const memory = emptyMemory('ar')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Istanbul',
      destinations: ['Istanbul'],
      durationDays: 3,
      budgetAmount: 8000,
      budgetCurrency: 'SAR',
    }
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount', 'origin']

    const facts = buildTravelFacts({
      memory,
      objective: 'collect_missing',
      missingSlots: ['destination', 'durationDays', 'budgetAmount', 'origin'],
    })

    expect(facts.missingSlots).toEqual(['origin'])
    expect(facts.known.destination).toBe('Istanbul')
    expect(facts.known.durationDays).toBe(3)
  })
})
