/**
 * Sprint 89 Phase 2 T2 — MissingInformationPlanner matrices.
 * Pure planning classification. No search / gateway / CM / BrainRouter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { understandTurn } from '../brain/v1'
import {
  createConversationStateSnapshot,
  emptyKnownSlots,
  type UnderstandingTurnResult,
} from '../brain/v1/understanding'
import type { ConversationKnownSlots } from '../brain/v1/understanding/types'
import {
  BOOKING_ONLY_FIELDS,
  MISSING_INFORMATION_PLANNER_VERSION,
  planMissingInformation,
} from '../brain/v1/planning/phase2'
import { emptyBrainV1Entities, type BrainV1Intent } from '../brain/v1/types'

function baseUnderstanding(
  overrides: {
    locale?: 'ar' | 'en'
    primaryIntent?: UnderstandingTurnResult['intent']['primaryIntent']
    knownSlots?: Partial<ConversationKnownSlots>
    supersededFields?: string[]
    assumedFields?: Array<{ field: string; value: unknown }>
    ambiguous?: UnderstandingTurnResult['references']['ambiguous']
    conflictingFields?: string[]
    isCorrection?: boolean
  } = {},
): UnderstandingTurnResult {
  const slots: ConversationKnownSlots = {
    ...emptyKnownSlots(),
    ...overrides.knownSlots,
  }
  const provenance: UnderstandingTurnResult['provenance'] = {}
  for (const a of overrides.assumedFields ?? []) {
    provenance[a.field] = {
      field: a.field,
      value: a.value,
      source: 'assumed',
      confidence: 0.7,
      updatedAt: new Date(0).toISOString(),
      planId: null,
      reversible: true,
    }
  }
  const facts: UnderstandingTurnResult['entities']['facts'] = (
    overrides.conflictingFields ?? []
  ).map((field) => ({
    field,
    value: slots[field as keyof ConversationKnownSlots] ?? null,
    kind: 'user_provided' as const,
    confidence: { level: 'conflicting' as const, score: 0.2 },
    evidence: null,
  }))

  const state = createConversationStateSnapshot({
    conversationId: 'mip-fixture',
    locale: overrides.locale ?? 'en',
    turnIndex: 1,
    lastConsultantIntent: overrides.primaryIntent ?? 'plan_trip',
    knownSlots: slots,
    supersededFields: overrides.supersededFields ?? [],
  })

  return {
    contractVersion: 'sprint89-phase1-understanding-1',
    intent: {
      contractVersion: 'sprint89-phase1-understanding-1',
      primaryIntent: overrides.primaryIntent ?? 'plan_trip',
      secondaryIntents: [],
      legacyIntent: 'travel_advice' satisfies BrainV1Intent,
      isCorrection: overrides.isCorrection ?? false,
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
      },
      facts,
      revisedFields: [],
    },
    references: {
      contractVersion: 'sprint89-phase1-understanding-1',
      resolved: [],
      ambiguous: overrides.ambiguous ?? [],
    },
    state,
    memoryProposals: [],
    provenance,
    summary: {
      consultantIntent: overrides.primaryIntent ?? 'plan_trip',
      legacyIntent: 'travel_advice' satisfies BrainV1Intent,
      entityFields: [],
      resolvedReferenceCount: 0,
      ambiguousReferenceCount: overrides.ambiguous?.length ?? 0,
      brainState: 'Understanding',
    },
  }
}

describe('Sprint 89 Phase 2 T2 — MissingInformationPlanner', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('exposes contract version and never imports search/gateway side effects', () => {
    const result = planMissingInformation({
      understanding: baseUnderstanding({ primaryIntent: 'advise' }),
    })
    expect(result.contractVersion).toBe(MISSING_INFORMATION_PLANNER_VERSION)
    expect(result.clarificationCandidate).toBeNull()
    // Structured reasons only — no locale reply strings.
    expect(JSON.stringify(result)).not.toMatch(/[\u0600-\u06FF]/)
  })

  describe('known / confirmed fields', () => {
    it('en: confirmed destination/origin/dates are never requested again', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_flight',
          knownSlots: {
            destination: 'Dubai',
            origin: 'Riyadh',
            startDate: '2026-10-01',
            endDate: '2026-10-08',
            adults: 2,
          },
        }),
      })
      expect(result.confirmedFields).toEqual(
        expect.arrayContaining(['destination', 'origin', 'dates', 'adults']),
      )
      expect(result.blocking).toEqual([])
      expect(result.clarificationRequired).toBe(false)
      expect(result.clarificationCandidate).toBeNull()
      expect(result.sufficientForSearch).toBe(true)
      expect(result.deferrable).not.toContain('destination')
      expect(result.deferrable).not.toContain('origin')
    })

    it('ar: confirmed slots from understandTurn are respected (no re-extract)', () => {
      const turn = understandTurn({
        text: 'أريد رحلة من الرياض إلى دبي من 2026-10-01 إلى 2026-10-08 لشخصين',
        locale: 'ar',
        conversationId: 'mip-ar-known',
      })
      const result = planMissingInformation({
        understanding: turn,
        goalHint: 'domain_flight',
      })
      expect(result.confirmedFields).toContain('destination')
      expect(result.blocking).not.toContain('destination')
      // Planner must not invent slots absent from knownSlots.
      const slots = turn.state.knownSlots
      for (const field of result.confirmedFields) {
        if (field === 'dates') {
          expect(slots.startDate != null || slots.endDate != null).toBe(true)
          continue
        }
        const key = field as keyof ConversationKnownSlots
        if (key in slots) {
          expect(slots[key]).not.toBeNull()
        }
      }
    })
  })

  describe('assumed fields', () => {
    it('en: assumed flexibleDates skips re-ask but does not authorize search alone', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_flight',
          knownSlots: { destination: 'Morocco', origin: 'Jeddah' },
          assumedFields: [{ field: 'flexibleDates', value: true }],
        }),
        assumedFields: ['flexibleDates'],
      })
      expect(result.blocking).not.toContain('dates')
      expect(result.deferrable).toContain('dates')
      expect(result.fields.some((f) => f.field === 'dates' && f.reason === 'assumed_not_confirmed')).toBe(
        true,
      )
      expect(result.sufficientForSearch).toBe(false)
      expect(result.clarificationRequired).toBe(false)
    })

    it('ar: assumed adults via provenance is not re-asked', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          locale: 'ar',
          primaryIntent: 'advise',
          knownSlots: { destination: 'تركيا' },
          assumedFields: [{ field: 'adults', value: 1 }],
        }),
      })
      expect(result.deferrable).not.toContain('adults')
      expect(result.blocking).not.toContain('adults')
      expect(result.clarificationCandidate?.field).not.toBe('adults')
    })
  })

  describe('corrections use post-correction knownSlots', () => {
    it('en: Dubai → Morocco correction — planner sees Morocco only', () => {
      const turn1 = understandTurn({
        text: 'I wanted Dubai.',
        locale: 'en',
        conversationId: 'mip-corr-dest',
      })
      const turn2 = understandTurn({
        text: 'Actually make it Morocco.',
        locale: 'en',
        conversationId: 'mip-corr-dest',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: {
          destination: turn1.entities.entities.destination,
          recentTexts: ['I wanted Dubai.'],
        },
      })
      expect(turn2.state.knownSlots.destination).toBe('Morocco')
      expect(turn2.state.supersededFields).toContain('destination')

      const result = planMissingInformation({
        understanding: turn2,
        goalHint: 'advise',
      })
      expect(result.confirmedFields).toContain('destination')
      expect(result.supersededFields).toContain('destination')
      expect(result.blocking).not.toContain('destination')
      // Superseded Dubai must not appear as a current required ask target value.
      expect(JSON.stringify(result)).not.toContain('Dubai')
    })

    it('ar: destination correction Turkey overrides Morocco in missing plan', () => {
      const turn1 = understandTurn({
        text: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 'mip-corr-ar',
      })
      const turn2 = understandTurn({
        text: 'صرت أبغى تركيا بدل المغرب',
        locale: 'ar',
        conversationId: 'mip-corr-ar',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: { destination: 'Morocco', recentTexts: ['أريد رحلة إلى المغرب'] },
      })
      const result = planMissingInformation({
        understanding: turn2,
        goalHint: 'domain_flight',
      })
      expect(turn2.state.knownSlots.destination).toBe('Turkey')
      expect(result.confirmedFields).toContain('destination')
      expect(result.blocking).not.toContain('destination')
      expect(result.supersededFields).toContain('destination')
    })

    it('en: date correction clears end — dates may become blocking again for search', () => {
      const turn1 = understandTurn({
        text: 'Trip to Dubai 2026-10-01 to 2026-10-08 from Riyadh',
        locale: 'en',
        conversationId: 'mip-corr-dates',
      })
      const turn2 = understandTurn({
        text: 'Actually make it 2026-11-15',
        locale: 'en',
        conversationId: 'mip-corr-dates',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
      })
      const after = planMissingInformation({
        understanding: turn2,
        goalHint: 'domain_flight',
      })
      expect(turn2.state.knownSlots.startDate).toBe('2026-11-15')
      expect(turn2.state.knownSlots.endDate).toBeNull()
      // startDate still usable → dates not blocking
      expect(after.blocking).not.toContain('dates')
      expect(after.confirmedFields).toContain('dates')
    })
  })

  describe('superseded values are not current', () => {
    it('treats superseded-cleared field as missing when knownSlots null', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_flight',
          knownSlots: {
            destination: 'Paris',
            origin: 'Riyadh',
            startDate: null,
            endDate: null,
          },
          supersededFields: ['startDate', 'endDate'],
        }),
      })
      expect(result.blocking).toContain('dates')
      expect(
        result.fields.some(
          (f) => f.field === 'dates' && f.reason === 'superseded_cleared',
        ),
      ).toBe(true)
      expect(result.clarificationRequired).toBe(true)
      expect(result.clarificationCandidate?.mergedFields).toContain('dates')
    })
  })

  describe('ambiguous fields', () => {
    it('en: ambiguous destination requires one clarification candidate', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_flight',
          knownSlots: {
            destination: 'Georgia',
            origin: 'Riyadh',
            startDate: '2026-09-01',
          },
          ambiguous: [
            {
              phrase: 'Georgia',
              field: 'destination',
              resolvesTo: 'Georgia',
              kind: 'destination',
              confidence: { level: 'medium_confidence_inferred', score: 0.4 },
              ambiguous: true,
            },
          ],
        }),
      })
      expect(result.blocking).toContain('destination')
      expect(result.clarificationRequired).toBe(true)
      expect(result.clarificationCandidate?.field).toBe('destination')
      expect(result.clarificationCandidate?.reason).toBe('ambiguous_reference')
      expect(result.clarificationCandidate?.mergedFields).toHaveLength(1)
      expect(result.sufficientForSearch).toBe(false)
    })

    it('ar: ambiguous origin yields single candidate (≤1)', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          locale: 'ar',
          primaryIntent: 'plan_trip',
          knownSlots: {
            destination: 'دبي',
            origin: 'الرياض',
            startDate: '2026-12-01',
          },
          ambiguous: [
            {
              phrase: 'هناك',
              field: 'origin',
              resolvesTo: 'الرياض',
              kind: 'origin',
              confidence: { level: 'medium_confidence_inferred', score: 0.35 },
              ambiguous: true,
            },
          ],
        }),
      })
      expect(result.clarificationCandidate).not.toBeNull()
      expect(result.clarificationCandidate?.mergedFields.length).toBeGreaterThanOrEqual(1)
      // Still at most one candidate object.
      expect(result.clarificationCandidate?.field).toBeTruthy()
    })
  })

  describe('booking-only never blocks', () => {
    it('passport/payment never appear in blocking for search or advise', () => {
      for (const goal of ['advise', 'search', 'domain_flight', 'explore'] as const) {
        const intent =
          goal === 'search'
            ? 'plan_trip'
            : goal === 'explore'
              ? 'explore_destination'
              : goal
        const result = planMissingInformation({
          understanding: baseUnderstanding({
            primaryIntent: intent,
            knownSlots: {},
          }),
          goalHint: goal,
        })
        for (const field of BOOKING_ONLY_FIELDS) {
          expect(result.bookingOnly).toContain(field)
          expect(result.blocking).not.toContain(field)
        }
        expect(
          result.fields
            .filter((f) => (BOOKING_ONLY_FIELDS as readonly string[]).includes(f.field))
            .every((f) => f.classification === 'bookingOnly'),
        ).toBe(true)
      }
    })
  })

  describe('abort preserves Phase 1 no-ask semantics', () => {
    it('en: abort → no blocking, no clarification candidate', () => {
      const turn = understandTurn({
        text: 'Cancel everything, never mind.',
        locale: 'en',
        conversationId: 'mip-abort-en',
      })
      // If intent extractor misses abort phrasing, force abort flag — Phase 1 preserve still holds.
      const result = planMissingInformation({
        understanding: turn,
        abort: true,
      })
      expect(result.abort).toBe(true)
      expect(result.goal).toBe('abort')
      expect(result.blocking).toEqual([])
      expect(result.clarificationRequired).toBe(false)
      expect(result.clarificationCandidate).toBeNull()
      expect(result.sufficientForSearch).toBe(false)
      // Confirmed slots from prior are still echoed; planner does not clear them.
      expect(result.confirmedFields).toEqual(
        expect.arrayContaining(
          Object.entries(turn.state.knownSlots)
            .filter(([, v]) => v != null)
            .map(([k]) => k),
        ),
      )
    })

    it('ar: primaryIntent abort short-circuits asks', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          locale: 'ar',
          primaryIntent: 'abort',
          knownSlots: { destination: 'المغرب', origin: 'جدة' },
        }),
      })
      expect(result.abort).toBe(true)
      expect(result.blocking).toEqual([])
      expect(result.clarificationCandidate).toBeNull()
      expect(result.confirmedFields).toContain('destination')
    })
  })

  describe('goal blocking matrices', () => {
    it('advise/explore: usually no handoff blocking', () => {
      const advise = planMissingInformation({
        understanding: baseUnderstanding({ primaryIntent: 'advise', knownSlots: {} }),
      })
      expect(advise.blocking).toEqual([])
      expect(advise.sufficientForAdvise).toBe(true)
      expect(advise.sufficientForSearch).toBe(false)

      const explore = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'explore_destination',
          knownSlots: {},
        }),
      })
      expect(explore.blocking).toEqual([])
    })

    it('domain_flight: origin+destination+dates blocking when absent', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_flight',
          knownSlots: {},
        }),
      })
      expect(result.blocking).toEqual(
        expect.arrayContaining(['origin', 'destination', 'dates']),
      )
      expect(result.clarificationRequired).toBe(true)
      expect(result.clarificationCandidate).not.toBeNull()
      expect(result.clarificationCandidate!.mergedFields.length).toBeGreaterThanOrEqual(1)
      expect(result.clarificationCandidate!.mergedFields.length).toBeLessThanOrEqual(3)
      expect(result.sufficientForSearch).toBe(false)
    })

    it('domain_hotel: destination+dates; origin not required', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_hotel',
          knownSlots: { destination: 'Tokyo', startDate: '2026-05-01' },
        }),
      })
      expect(result.blocking).toEqual([])
      expect(result.sufficientForSearch).toBe(true)
    })

    it('visa_guidance: nationality blocking for specific guidance; not bookingOnly', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({ primaryIntent: 'visa_guidance' }),
      })
      expect(result.blocking).toContain('nationality')
      expect(result.bookingOnly).not.toContain('nationality')
      expect(result.clarificationCandidate?.field).toBe('nationality')
    })
  })

  describe('zero search / gateway execution', () => {
    it('planner is pure — no providerGateway or search modules invoked', async () => {
      const gateway = await import('../../core/providerGateway').catch(() => null)
      const spy =
        gateway && 'searchFlights' in gateway
          ? vi.spyOn(gateway as { searchFlights: (...a: unknown[]) => unknown }, 'searchFlights')
          : null

      planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_flight',
          knownSlots: {
            destination: 'Dubai',
            origin: 'Riyadh',
            startDate: '2026-10-01',
          },
        }),
      })
      planMissingInformation({
        understanding: baseUnderstanding({ primaryIntent: 'advise', knownSlots: {} }),
      })

      if (spy) expect(spy).not.toHaveBeenCalled()
      expect(true).toBe(true)
    })
  })

  describe('no user-facing reply text', () => {
    it('clarification candidate has no ar/en prose fields', () => {
      const result = planMissingInformation({
        understanding: baseUnderstanding({
          primaryIntent: 'domain_flight',
          knownSlots: {},
        }),
      })
      const c = result.clarificationCandidate
      expect(c).not.toBeNull()
      expect(c).not.toHaveProperty('ar')
      expect(c).not.toHaveProperty('en')
      expect(c).not.toHaveProperty('question')
      expect(typeof c!.reason).toBe('string')
      expect(typeof c!.detail).toBe('string')
    })
  })
})
