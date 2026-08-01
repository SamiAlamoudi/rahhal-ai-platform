/**
 * Sprint 89 Phase 2 T3 — AssumptionPolicy + MemoryManager assumed-source.
 * No Search / ProviderGateway / BrainRouter / CM / flag changes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyMemory } from '../agent/types'
import { resetFeatureRegistry } from '../ai'
import {
  createUnderstandingMemoryManager,
  understandTurn,
} from '../brain/v1'
import {
  createConversationStateSnapshot,
  emptyKnownSlots,
  type UnderstandingTurnResult,
} from '../brain/v1/understanding'
import type { ConversationKnownSlots } from '../brain/v1/understanding/types'
import {
  ASSUMPTION_POLICY_VERSION,
  assertAssumptionWritable,
  createAssumptionPolicy,
  promoteAssumptionToConfirmed,
  proposeAssumptions,
} from '../brain/v1/planning/phase2'
import { emptyBrainV1Entities, type BrainV1Intent } from '../brain/v1/types'

function fixtureUnderstanding(
  overrides: {
    locale?: 'ar' | 'en'
    primaryIntent?: UnderstandingTurnResult['intent']['primaryIntent']
    knownSlots?: Partial<ConversationKnownSlots>
    currency?: string | null
  } = {},
): UnderstandingTurnResult {
  const slots: ConversationKnownSlots = {
    ...emptyKnownSlots(),
    ...overrides.knownSlots,
  }
  const state = createConversationStateSnapshot({
    conversationId: 'assume-fixture',
    locale: overrides.locale ?? 'en',
    turnIndex: 1,
    lastConsultantIntent: overrides.primaryIntent ?? 'advise',
    knownSlots: slots,
  })
  return {
    contractVersion: 'sprint89-phase1-understanding-1',
    intent: {
      contractVersion: 'sprint89-phase1-understanding-1',
      primaryIntent: overrides.primaryIntent ?? 'advise',
      secondaryIntents: [],
      legacyIntent: 'travel_advice' satisfies BrainV1Intent,
      isCorrection: false,
      isConfirmation: false,
      confidence: { level: 'confirmed', score: 1 },
    },
    entities: {
      contractVersion: 'sprint89-phase1-understanding-1',
      entities: {
        ...emptyBrainV1Entities(),
        destination: slots.destination,
        origin: slots.origin,
        travelDates: { start: slots.startDate, end: slots.endDate },
        adults: slots.adults,
        children: slots.children,
        travelerCount: slots.travelerCount,
        budget: slots.budget,
        currency: overrides.currency ?? null,
      },
      facts: [],
      revisedFields: [],
    },
    references: {
      contractVersion: 'sprint89-phase1-understanding-1',
      resolved: [],
      ambiguous: [],
    },
    state,
    memoryProposals: [],
    provenance: {},
    summary: {
      consultantIntent: overrides.primaryIntent ?? 'advise',
      legacyIntent: 'travel_advice',
      entityFields: [],
      resolvedReferenceCount: 0,
      ambiguousReferenceCount: 0,
      brainState: 'Understanding',
    },
  }
}

describe('Sprint 89 Phase 2 T3 — AssumptionPolicy + assumed memory', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  describe('assumed values', () => {
    it('en: proposes adults/flexibleDates/cabin with source assumed only', () => {
      const result = proposeAssumptions({
        understanding: fixtureUnderstanding({
          locale: 'en',
          knownSlots: { destination: 'Morocco' },
        }),
      })
      expect(result.contractVersion).toBe(ASSUMPTION_POLICY_VERSION)
      expect(result.proposed.length).toBeGreaterThan(0)
      for (const p of result.proposed) {
        expect(p.source).toBe('assumed')
        expect(p.confidence.level).toBe('assumption')
        expect(p.reversible).toBe(true)
        expect(p.provenance.source).toBe('assumed')
        expect(p.provenance.reversible).toBe(true)
        expect(p.reason).toBeTruthy()
      }
      expect(result.assumedFields).toEqual(
        expect.arrayContaining(['adults', 'flexibleDates', 'cabin']),
      )
      expect(result.proposed.some((p) => p.field === 'destination')).toBe(false)
      expect(result.proposed.some((p) => p.field === 'budget')).toBe(false)
    })

    it('ar: soft currency assumption from locale; no invented budget', () => {
      const result = proposeAssumptions({
        understanding: fixtureUnderstanding({
          locale: 'ar',
          primaryIntent: 'explore_destination',
          knownSlots: { destination: 'دبي' },
        }),
      })
      const currency = result.proposed.find((p) => p.field === 'currency')
      expect(currency?.value).toBe('SAR')
      expect(currency?.source).toBe('assumed')
      expect(result.proposed.some((p) => p.field === 'budget' || p.field === 'budgetAmount')).toBe(
        false,
      )
      expect(assertAssumptionWritable({ field: 'budget', source: 'assumed' })?.reason).toBe(
        'rejected_invented_budget',
      )
    })

    it('pace is propose-only (not committable)', () => {
      const result = proposeAssumptions({
        understanding: fixtureUnderstanding({ knownSlots: {} }),
      })
      const pace = result.proposed.find((p) => p.field === 'pace')
      expect(pace?.commitToMemory).toBe(false)
      expect(result.committable.some((p) => p.field === 'pace')).toBe(false)
    })
  })

  describe('MemoryManager assumed persistence', () => {
    it('stores assumed writes as reversible assumed provenance (separate from confirmed)', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Morocco',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Morocco',
        },
      ]).memory

      const policy = createAssumptionPolicy()
      const proposed = policy.propose({
        understanding: fixtureUnderstanding({
          knownSlots: { destination: 'Morocco' },
        }),
      })

      const applied = mm.applyAssumptions(
        memory,
        proposed.committable.map((p) => ({
          field: p.field,
          value: p.value,
          source: 'assumed' as const,
          reason: p.reason,
          confidence: p.confidence.score,
          provenance: p.provenance,
        })),
      )

      expect(applied.rejected).toEqual([])
      expect(applied.memory.requirements.travelers).toBe(1)
      expect(applied.memory.requirements.cabinPreference).toBe('economy')
      expect(applied.provenance.travelers?.source).toBe('assumed')
      expect(applied.provenance.travelers?.reversible).toBe(true)
      expect(applied.provenance.destination?.source).toBe('user_stated')

      const confirmed = mm.listConfirmedProvenance()
      const assumed = mm.listAssumedProvenance()
      expect(confirmed.destination?.value).toBe('Morocco')
      expect(assumed.travelers?.value).toBe(1)
      expect(assumed.destination).toBeUndefined()
      expect(confirmed.travelers).toBeUndefined()

      // flexibleDates lives in assumed provenance (not a TripRequirements slot).
      expect(mm.getProvenance().flexibleDates?.source).toBe('assumed')
      expect(mm.getProvenance().flexibleDates?.value).toBe(true)
    })

    it('applyEntityFacts still rejects bare assumptions (no silent confirm)', () => {
      const mm = createUnderstandingMemoryManager()
      const result = mm.applyEntityFacts(emptyMemory('ar'), [
        {
          field: 'cabinClass',
          value: 'economy',
          kind: 'assumption',
          confidence: { level: 'assumption', score: 0.7 },
          evidence: null,
        },
      ])
      expect(result.rejected.some((r) => r.reason === 'assumption_deferred_to_phase2')).toBe(true)
      expect(result.memory.requirements.cabinPreference).toBeNull()
      expect(result.provenance.cabinPreference).toBeUndefined()
    })
  })

  describe('corrections override assumptions immediately', () => {
    it('en: user correction replaces assumed travelers and marks user_stated', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = mm.applyAssumptions(memory, [
        {
          field: 'adults',
          value: 1,
          source: 'assumed',
          reason: 'default_single_traveler',
          confidence: 0.62,
        },
      ]).memory
      expect(memory.requirements.travelers).toBe(1)
      expect(mm.getProvenance().travelers?.source).toBe('assumed')

      const corrected = mm.applyEntityFacts(memory, [
        {
          field: 'adults',
          value: 3,
          kind: 'corrected',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Actually 3 adults',
        },
      ])
      expect(corrected.memory.requirements.travelers).toBe(3)
      expect(corrected.provenance.travelers?.source).toBe('user_stated')
      expect(corrected.provenance.travelers?.corrected).toBe(true)
      expect(corrected.provenance.travelers?.previousValue).toBe(1)
      expect(mm.listAssumedProvenance().travelers).toBeUndefined()
      expect(mm.listConfirmedProvenance().travelers?.value).toBe(3)
    })

    it('ar: understandTurn correction path still overrides prior assumed cabin via MemoryManager', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('ar')
      memory = mm.applyAssumptions(memory, [
        {
          field: 'cabin',
          value: 'economy',
          source: 'assumed',
          reason: 'default_cabin_economy',
        },
      ]).memory

      const turn1 = understandTurn({
        text: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 'assume-corr-ar',
      })
      memory = mm.applyEntityFacts(memory, turn1.entities.facts.filter((f) => f.kind !== 'assumption'))
        .memory

      const turn2 = understandTurn({
        text: 'صرت أبغى تركيا بدل المغرب',
        locale: 'ar',
        conversationId: 'assume-corr-ar',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: { destination: 'Morocco' },
      })
      const applied = mm.applyEntityFacts(memory, turn2.entities.facts)
      expect(turn2.state.knownSlots.destination).toBe('Turkey')
      expect(applied.memory.requirements.destination).toBe('Turkey')
      expect(applied.provenance.destination?.source).toBe('user_stated')
      // Assumed cabin remains assumed until explicitly corrected.
      expect(mm.getProvenance().cabinPreference?.source).toBe('assumed')
    })
  })

  describe('assumed never becomes confirmed', () => {
    it('rejects writes that claim confirmed source/level', () => {
      const mm = createUnderstandingMemoryManager()
      const illegalPromotion = [
        {
          field: 'adults',
          value: 1,
          source: 'assumed' as const,
          reason: 'ok',
        },
        {
          field: 'cabin',
          value: 'economy',
          source: 'user_stated' as 'assumed',
          reason: 'illegal_promotion',
        },
      ]
      const bad = mm.applyAssumptions(emptyMemory('en'), illegalPromotion)
      expect(bad.rejected.some((r) => r.field === 'cabin')).toBe(true)
      expect(bad.provenance.cabinPreference).toBeUndefined()

      expect(
        assertAssumptionWritable({
          field: 'cabin',
          source: 'assumed',
          confidenceLevel: 'confirmed',
        })?.reason,
      ).toBe('rejected_promotion_forbidden')

      expect(() => promoteAssumptionToConfirmed('cabin')).toThrow(
        /phase2_cannot_promote_assumed_to_confirmed/,
      )
      expect(() => mm.promoteAssumedToConfirmed('cabin')).toThrow(
        /phase2_cannot_promote_assumed_to_confirmed/,
      )
    })

    it('does not overwrite confirmed destination with an assumption', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Dubai',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Dubai',
        },
      ]).memory
      const result = mm.applyAssumptions(memory, [
        {
          field: 'destination',
          value: 'Morocco',
          source: 'assumed',
          reason: 'illegal_core_slot',
        },
      ])
      expect(result.memory.requirements.destination).toBe('Dubai')
      expect(result.rejected.some((r) => r.field === 'destination')).toBe(true)
      expect(result.provenance.destination?.source).toBe('user_stated')
    })
  })

  describe('abort / recovery', () => {
    it('abort propose is empty; applyAssumptions preserveOnAbort is no-op', () => {
      const proposed = proposeAssumptions({
        understanding: fixtureUnderstanding({
          primaryIntent: 'abort',
          knownSlots: { destination: 'Paris' },
        }),
      })
      expect(proposed.abort).toBe(true)
      expect(proposed.proposed).toEqual([])
      expect(proposed.committable).toEqual([])

      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Paris',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Paris',
        },
      ]).memory
      memory = mm.applyAssumptions(memory, [
        {
          field: 'adults',
          value: 1,
          source: 'assumed',
          reason: 'default_single_traveler',
        },
      ]).memory

      const aborted = mm.applyAssumptions(
        memory,
        [
          {
            field: 'cabin',
            value: 'business',
            source: 'assumed',
            reason: 'should_not_apply',
          },
        ],
        { preserveOnAbort: true },
      )
      expect(aborted.memory.requirements.destination).toBe('Paris')
      expect(aborted.memory.requirements.travelers).toBe(1)
      expect(aborted.memory.requirements.cabinPreference).toBeNull()
      expect(aborted.applied).toHaveLength(0)
      expect(mm.getProvenance().travelers?.source).toBe('assumed')
      expect(mm.getProvenance().destination?.source).toBe('user_stated')
    })

    it('recovery recomputes assumptions without wiping confirmed memory', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('ar')
      memory = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Turkey',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'تركيا',
        },
      ]).memory

      const first = proposeAssumptions({
        understanding: fixtureUnderstanding({
          locale: 'ar',
          knownSlots: { destination: 'Turkey' },
        }),
      })
      memory = mm.applyAssumptions(
        memory,
        first.committable.map((p) => ({
          field: p.field,
          value: p.value,
          source: 'assumed' as const,
          reason: p.reason,
          confidence: p.confidence.score,
          provenance: p.provenance,
        })),
      ).memory

      // Simulate recovery: re-propose with prior assumed fields — no duplicate assumed writes.
      const recovered = proposeAssumptions({
        understanding: fixtureUnderstanding({
          locale: 'ar',
          knownSlots: { destination: 'Turkey' },
        }),
        priorAssumedFields: first.assumedFields,
      })
      expect(recovered.proposed.filter((p) => p.commitToMemory)).toHaveLength(0)
      expect(memory.requirements.destination).toBe('Turkey')
      expect(mm.listConfirmedProvenance().destination?.value).toBe('Turkey')
      expect(mm.listAssumedProvenance().travelers?.source).toBe('assumed')
    })
  })

  describe('zero search / gateway', () => {
    it('policy + memory path never invokes provider gateway', async () => {
      const gatewayMod = await import('../../core/providerGateway').catch(() => null)
      const maybeSearch = gatewayMod
        ? (gatewayMod as unknown as { searchFlights?: (...a: unknown[]) => unknown }).searchFlights
        : undefined
      const spy =
        typeof maybeSearch === 'function'
          ? vi.spyOn(
              gatewayMod as unknown as { searchFlights: (...a: unknown[]) => unknown },
              'searchFlights',
            )
          : null

      const policy = createAssumptionPolicy()
      const proposed = policy.propose({
        understanding: fixtureUnderstanding({ knownSlots: { destination: 'Dubai' } }),
      })
      const mm = createUnderstandingMemoryManager()
      mm.applyAssumptions(
        emptyMemory('en'),
        proposed.committable.map((p) => ({
          field: p.field,
          value: p.value,
          source: 'assumed' as const,
          reason: p.reason,
        })),
      )
      if (spy) expect(spy).not.toHaveBeenCalled()
      expect(proposed.proposed.every((p) => p.source === 'assumed')).toBe(true)
    })
  })
})
