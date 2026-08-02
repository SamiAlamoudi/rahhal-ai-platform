import { describe, expect, it } from 'vitest'
import { createTravelBrain, processBrainTurn } from '../brain'
import { mapTraceToError } from './mapError'
import type { BrainTurnTrace } from '../brain'

function baseTrace(over: Partial<BrainTurnTrace> = {}): BrainTurnTrace {
  const brain = createTravelBrain()
  // sync placeholder — tests override fields
  return {
    userText: 'x',
    intent: { id: 'unknown', confidence: 0, locale: 'en', matchedSignals: [] },
    entities: { rawMentions: [] },
    references: [],
    draft: {},
    safety: { status: 'ok', message: 'ok', missingFields: [] },
    reasoner: { overallFeasible: true, findings: [] },
    decision: { action: 'clarify', toolRoute: null, rationale: [] },
    preferences: brain.conversation.preferences.getProfile(),
    recommendations: {
      flights: [],
      hotels: [],
      packages: [],
      activities: [],
      restaurants: [],
    },
    plan: { nights: 3, steps: [], assumptions: [] },
    timeline: [],
    pricing: { currency: 'SAR', low: 1, mid: 2, high: 3, note: '' },
    reply: 'r',
    travelSession: {
      id: 'ts',
      userId: 'u',
      createdAt: '',
      updatedAt: '',
      draft: {},
      shortTerm: {
        recentTurns: [],
        activeDraft: {},
        lastMentionedOptions: [],
        unresolvedReferences: [],
      },
      status: 'open',
    },
    shortTerm: {
      recentTurns: [],
      activeDraft: {},
      lastMentionedOptions: [],
      unresolvedReferences: [],
    },
    ...over,
  }
}

describe('mapTraceToError', () => {
  it('maps contradictory to budget_conflict', () => {
    const err = mapTraceToError(
      baseTrace({
        safety: {
          status: 'block',
          code: 'contradictory_request',
          message: 'conflict',
          missingFields: [],
        },
      }),
    )
    expect(err?.code).toBe('budget_conflict')
  })

  it('maps impossible itinerary', () => {
    const err = mapTraceToError(
      baseTrace({
        safety: {
          status: 'block',
          code: 'impossible_itinerary',
          message: 'same city',
          missingFields: [],
        },
      }),
    )
    expect(err?.code).toBe('impossible_itinerary')
  })

  it('maps ambiguous request', () => {
    const err = mapTraceToError(
      baseTrace({
        safety: {
          status: 'clarify',
          code: 'ambiguous_request',
          message: '?',
          missingFields: [],
        },
      }),
    )
    expect(err?.code).toBe('ambiguous_request')
  })

  it('flags unknown destination', () => {
    const err = mapTraceToError(
      baseTrace({
        draft: { destination: 'Nairobi' },
        decision: { action: 'clarify', toolRoute: null, rationale: [] },
        safety: { status: 'clarify', message: 'need more', missingFields: [] },
      }),
    )
    expect(err?.code).toBe('unknown_destination')
  })

  it('returns null when routing ok', async () => {
    const brain = createTravelBrain()
    await brain.begin('e1', 'en')
    const trace = processBrainTurn(brain, 'Book a flight from Riyadh to Istanbul budget 5000 SAR')
    expect(mapTraceToError(trace)).toBeNull()
  })
})
