/**
 * Sprint 9 Phase 3 — consultant voice.
 */
import { describe, expect, it } from 'vitest'
import { emptyMemory, emptyRequirements } from '../agent/types'
import { buildConsultantReply } from '../concierge/consultantVoice'
import { decideConciergeTurn } from '../concierge/turnPolicy'
import { advanceConciergeState, emptyConciergeState } from '../concierge'
import { extractSoftSignals } from '../concierge/softSignals'

describe('Concierge Phase 3 — consultant voice', () => {
  it('greets in English without form language or provider names', () => {
    const memory = emptyMemory('en')
    memory.missingFields = ['destination', 'durationDays', 'budgetAmount', 'travelers']
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'Hello',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous: null,
    })
    const reply = buildConsultantReply({
      locale: 'en',
      decision,
      requirements: memory.requirements,
    })
    expect(reply).toMatch(/consultant|Bilamo/i)
    expect(reply.toLowerCase()).not.toMatch(/fill (out )?the form|required field/)
    expect(reply.toLowerCase()).not.toMatch(/amadeus|duffel|travelport|sabre|expedia|booking\.com/)
  })

  it('greets in Arabic as a consultant', () => {
    const memory = emptyMemory('ar')
    memory.missingFields = ['destination', 'durationDays']
    const decision = decideConciergeTurn({
      locale: 'ar',
      memory,
      userText: 'مرحبا',
      intent: 'plan',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous: null,
    })
    const reply = buildConsultantReply({
      locale: 'ar',
      decision,
      requirements: memory.requirements,
    })
    expect(reply).toMatch(/مستشار|بيلامو/)
    expect(reply).not.toMatch(/Amadeus|Duffel/)
  })

  it('acknowledges heard details when clarifying', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Bali',
      destinations: ['Bali'],
    }
    memory.missingFields = ['durationDays', 'budgetAmount', 'travelers']
    const previous = advanceConciergeState({
      previous: emptyConciergeState(),
      phase: 'discovery',
      lastAction: 'greet',
    })
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'Bali with a relaxed pace and beach',
      intent: 'answer',
      requirements: memory.requirements,
      missingFields: memory.missingFields,
      previous,
    })
    const reply = buildConsultantReply({
      locale: 'en',
      decision,
      requirements: memory.requirements,
    })
    expect(reply).toMatch(/Bali|Noted|relaxed|beach/i)
    // Value-first: consultant advises / proposes — does not census days/budget/people.
    expect(['propose_options', 'advise']).toContain(decision.action)
    expect(decision.askFields).toEqual([])
  })

  it('proposes options in a consultative tone', () => {
    const memory = emptyMemory('en')
    memory.requirements = {
      ...emptyRequirements(),
      destination: 'Paris',
      destinations: ['Paris'],
      durationDays: 5,
      budgetAmount: 3000,
      budgetCurrency: 'EUR',
      travelers: 2,
      interests: ['food'],
      budgetStyle: 'midrange',
      hotelPreference: 'boutique',
      weatherPreference: 'mild',
      packageScope: 'full_package',
    }
    memory.missingFields = []
    const previous = advanceConciergeState({
      previous: null,
      phase: 'deepening',
      softSignals: extractSoftSignals('relaxed food trip', 'en'),
    })
    previous.turnCount = 3
    const decision = decideConciergeTurn({
      locale: 'en',
      memory,
      userText: 'What directions would you suggest for a relaxed food trip?',
      intent: 'unknown',
      requirements: memory.requirements,
      missingFields: [],
      previous,
    })
    const reply = buildConsultantReply({
      locale: 'en',
      decision,
      requirements: memory.requirements,
    })
    expect(decision.action).toBe('propose_options')
    expect(reply).toMatch(/1\./)
    expect(reply).toMatch(/2\./)
    expect(reply).toMatch(/build the plan/i)
  })
})
