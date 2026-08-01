/**
 * Sprint 89 Phase 2 T5 — ClarificationBridge (pure planning).
 * No Search / ProviderGateway / BrainRouter / CM wiring / flags.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { emptyKnownSlots } from '../brain/v1/understanding'
import type { ConversationKnownSlots } from '../brain/v1/understanding/types'
import {
  CLARIFICATION_BRIDGE_VERSION,
  createClarificationBridge,
  mergeClarificationFields,
  planClarification,
  type ClarificationBridgeInput,
  type ConfidenceDecision,
} from '../brain/v1/planning/phase2'
import { CONFIDENCE_GATES_VERSION } from '../brain/v1/planning/phase2/ConfidenceGates'

function slots(partial: Partial<ConversationKnownSlots> = {}): ConversationKnownSlots {
  return { ...emptyKnownSlots(), ...partial }
}

function confidence(partial: Partial<ConfidenceDecision> = {}): ConfidenceDecision {
  return {
    contractVersion: CONFIDENCE_GATES_VERSION,
    confidenceLevel: 'unknown',
    searchEligible: false,
    shouldClarify: true,
    blockingReason: 'blocking_fields_missing',
    ...partial,
  }
}

function base(
  overrides: Omit<Partial<ClarificationBridgeInput>, 'knownSlots'> & {
    knownSlots?: Partial<ConversationKnownSlots>
  } = {},
): ClarificationBridgeInput {
  const { knownSlots: slotPartial, ...rest } = overrides
  return {
    missing: {
      blocking: [],
      deferrable: [],
      bookingOnly: ['passport', 'payment'],
      confirmedFields: [],
      abort: false,
      goal: 'domain_flight',
    },
    confidence: confidence(),
    assumptions: {
      assumedFields: [],
      abort: false,
      proposed: [],
    },
    knownSlots: slots(slotPartial),
    blockingFields: [],
    ambiguousFields: [],
    conflictingFields: [],
    correctedFields: [],
    confirmedFields: [],
    priorClarificationAttempts: [],
    abort: false,
    locale: 'en',
    ...rest,
  }
}

function assertNoUserFacingCopy(value: unknown): void {
  expect(value).not.toHaveProperty('ar')
  expect(value).not.toHaveProperty('en')
  expect(value).not.toHaveProperty('questionAr')
  expect(value).not.toHaveProperty('questionEn')
  expect(value).not.toHaveProperty('prompt')
  expect(value).not.toHaveProperty('questionText')
  const json = JSON.stringify(value)
  expect(json).not.toMatch(/\b(Where|When|What|Please)\b/)
  expect(json).not.toMatch(/هل|متى|أين/)
}

describe('Sprint 89 Phase 2 T5 — ClarificationBridge', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('versioned pure plan with CM injection design only (no CM wiring)', () => {
    const result = planClarification(
      base({
        missing: {
          blocking: ['destination'],
          deferrable: [],
          bookingOnly: ['passport'],
          confirmedFields: [],
          abort: false,
          goal: 'domain_flight',
        },
      }),
    )
    expect(result.contractVersion).toBe(CLARIFICATION_BRIDGE_VERSION)
    expect(result.cmInjectionDesign.mode).toBe('planning_hints_injection')
    expect(result.cmInjectionDesign.cmMustSkipSelection).toBe(true)
    expect(result.cmInjectionDesign.bridgeSuppliesCopy).toBe(false)
    assertNoUserFacingCopy(result)
  })

  describe('single missing field', () => {
    it('en: one blocking destination → single candidate', () => {
      const result = planClarification(
        base({
          locale: 'en',
          missing: {
            blocking: ['destination'],
            deferrable: ['budget'],
            bookingOnly: ['passport'],
            confirmedFields: [],
            abort: false,
            goal: 'advise',
          },
        }),
      )
      expect(result.shouldAsk).toBe(true)
      expect(result.questionCandidate?.field).toBe('destination')
      expect(result.mergedFields).toEqual(['destination'])
      expect(result.planningHints.questionBudgetUsed).toBe(1)
      expect(result.planningHints.moveHint).toBe('clarify')
      expect(result.avoidReasons.some((a) => a.reason === 'not_blocking' && a.field === 'budget')).toBe(
        true,
      )
    })

    it('ar: nationality blocking for visa_guidance', () => {
      const result = planClarification(
        base({
          locale: 'ar',
          knownSlots: { destination: 'تركيا' },
          confirmedFields: ['destination'],
          missing: {
            blocking: ['nationality'],
            deferrable: [],
            bookingOnly: ['passport'],
            confirmedFields: ['destination'],
            abort: false,
            goal: 'visa_guidance',
          },
        }),
      )
      expect(result.shouldAsk).toBe(true)
      expect(result.questionCandidate?.field).toBe('nationality')
      expect(result.mergedFields).toEqual(['nationality'])
      assertNoUserFacingCopy(result.questionCandidate)
    })
  })

  describe('multiple merged fields', () => {
    it('merges origin+destination+dates into one candidate', () => {
      expect(mergeClarificationFields(['dates', 'origin', 'destination'])).toEqual(
        expect.arrayContaining(['origin', 'destination', 'dates']),
      )
      const result = planClarification(
        base({
          missing: {
            blocking: ['origin', 'destination', 'dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: [],
            abort: false,
            goal: 'domain_flight',
          },
        }),
      )
      expect(result.shouldAsk).toBe(true)
      expect(result.mergedFields).toEqual(['origin', 'destination', 'dates'])
      expect(result.questionCandidate?.field).toBe('destination')
      expect(result.questionCandidate?.reason).toBe('merged_blocking_gap')
      // Exactly one candidate object.
      expect(result.questionCandidate).not.toBeNull()
      expect(result.planningHints.questionKey).toBe('destination')
    })
  })

  describe('ambiguity', () => {
    it('en: ambiguous destination remains askable even if slot present', () => {
      const result = planClarification(
        base({
          knownSlots: {
            destination: 'Georgia',
            origin: 'Riyadh',
            startDate: '2026-09-01',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          ambiguousFields: ['destination'],
          missing: {
            blocking: [],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination', 'origin', 'dates'],
            abort: false,
            goal: 'domain_flight',
          },
          confidence: confidence({
            shouldClarify: true,
            searchEligible: false,
            blockingReason: 'ambiguous_values',
          }),
        }),
      )
      expect(result.shouldAsk).toBe(true)
      expect(result.questionCandidate?.field).toBe('destination')
      expect(result.questionCandidate?.reason).toBe('ambiguous_reference')
    })
  })

  describe('conflicting corrections', () => {
    it('conflicting field produces clarify candidate', () => {
      const result = planClarification(
        base({
          knownSlots: { destination: 'Dubai', origin: 'Riyadh', startDate: '2026-10-01' },
          confirmedFields: ['destination', 'origin', 'dates'],
          conflictingFields: ['destination'],
          missing: {
            blocking: ['destination'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination', 'origin', 'dates'],
            abort: false,
            goal: 'domain_flight',
          },
          confidence: confidence({
            confidenceLevel: 'conflicting',
            shouldClarify: true,
            blockingReason: 'conflicting_values',
          }),
        }),
      )
      expect(result.shouldAsk).toBe(true)
      expect(result.questionCandidate?.reason).toBe('conflicting_confidence')
    })

    it('correction overrides prior candidate — now-known field not re-asked', () => {
      const result = planClarification(
        base({
          knownSlots: {
            destination: 'Morocco',
            origin: 'Jeddah',
            startDate: '2026-11-15',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          correctedFields: ['destination', 'dates'],
          missing: {
            blocking: [],
            deferrable: ['budget'],
            bookingOnly: ['passport'],
            confirmedFields: ['destination', 'origin', 'dates'],
            abort: false,
            goal: 'domain_flight',
          },
          confidence: confidence({
            searchEligible: true,
            shouldClarify: false,
            confidenceLevel: 'confirmed',
            blockingReason: null,
          }),
        }),
      )
      expect(result.shouldAsk).toBe(false)
      expect(result.questionCandidate).toBeNull()
      expect(result.mergedFields).toEqual([])
      expect(
        result.avoidReasons.some(
          (a) => a.field === 'destination' && a.reason === 'corrected_now_known',
        ),
      ).toBe(true)
    })
  })

  describe('booking-only / confirmed / assumed ignored', () => {
    it('never asks passport/payment even if listed in blockingFields', () => {
      const result = planClarification(
        base({
          blockingFields: ['passport', 'payment', 'destination'],
          missing: {
            blocking: ['passport'],
            deferrable: [],
            bookingOnly: ['passport', 'payment', 'payment_consent'],
            confirmedFields: [],
            abort: false,
            goal: 'domain_flight',
          },
        }),
      )
      expect(result.mergedFields).not.toContain('passport')
      expect(result.mergedFields).not.toContain('payment')
      expect(result.questionCandidate?.field).toBe('destination')
      expect(
        result.avoidReasons.filter((a) => a.reason === 'booking_deferred').length,
      ).toBeGreaterThan(0)
    })

    it('never re-asks confirmed slots; assumed dates skipped', () => {
      const result = planClarification(
        base({
          knownSlots: { destination: 'Paris', origin: 'Riyadh' },
          confirmedFields: ['destination', 'origin'],
          assumptions: {
            assumedFields: ['flexibleDates', 'dates', 'adults'],
            abort: false,
            proposed: [],
          },
          missing: {
            blocking: ['destination', 'origin', 'dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination', 'origin'],
            abort: false,
            goal: 'domain_flight',
          },
        }),
      )
      expect(result.shouldAsk).toBe(false)
      expect(result.questionCandidate).toBeNull()
      expect(result.avoidReasons.some((a) => a.reason === 'already_known')).toBe(true)
      expect(result.avoidReasons.some((a) => a.reason === 'assumed_safe')).toBe(true)
    })
  })

  describe('zero-question / abort / recovery', () => {
    it('blocking empty ⇒ shouldAsk=false (zero-question path)', () => {
      const result = planClarification(
        base({
          knownSlots: {
            destination: 'London',
            origin: 'Riyadh',
            startDate: '2026-06-01',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          missing: {
            blocking: [],
            deferrable: ['budget'],
            bookingOnly: ['passport'],
            confirmedFields: ['destination', 'origin', 'dates'],
            abort: false,
            goal: 'domain_flight',
          },
          confidence: confidence({
            searchEligible: true,
            shouldClarify: false,
            confidenceLevel: 'confirmed',
            blockingReason: null,
          }),
        }),
      )
      expect(result.shouldAsk).toBe(false)
      expect(result.questionCandidate).toBeNull()
      expect(result.planningHints.questionBudgetUsed).toBe(0)
      expect(result.planningHints.moveHint).toBe('none')
      expect(result.avoidReasons.some((a) => a.reason === 'zero_question_path')).toBe(true)
    })

    it('abort ⇒ no ask; moveHint abort', () => {
      const result = planClarification(
        base({
          abort: true,
          knownSlots: { destination: 'Cairo' },
          confirmedFields: ['destination'],
          missing: {
            blocking: ['origin', 'dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination'],
            abort: true,
            goal: 'domain_flight',
          },
        }),
      )
      expect(result.shouldAsk).toBe(false)
      expect(result.questionCandidate).toBeNull()
      expect(result.planningHints.moveHint).toBe('abort')
      expect(result.avoidReasons.some((a) => a.reason === 'abort_no_ask')).toBe(true)
    })

    it('recovery: after correction, prior clarify candidate cleared', () => {
      const before = planClarification(
        base({
          missing: {
            blocking: ['dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination', 'origin'],
            abort: false,
            goal: 'domain_flight',
          },
          knownSlots: { destination: 'Dubai', origin: 'Riyadh' },
          confirmedFields: ['destination', 'origin'],
        }),
      )
      expect(before.shouldAsk).toBe(true)

      const after = planClarification(
        base({
          knownSlots: {
            destination: 'Dubai',
            origin: 'Riyadh',
            startDate: '2026-11-15',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          correctedFields: ['dates'],
          missing: {
            blocking: [],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination', 'origin', 'dates'],
            abort: false,
            goal: 'domain_flight',
          },
          confidence: confidence({
            searchEligible: true,
            shouldClarify: false,
            confidenceLevel: 'confirmed',
            blockingReason: null,
          }),
        }),
      )
      expect(after.shouldAsk).toBe(false)
      expect(after.questionCandidate).toBeNull()
    })

    it('prior attempts ≥2 emit strategy_shift_examples without copy', () => {
      const result = planClarification(
        base({
          missing: {
            blocking: ['dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination'],
            abort: false,
            goal: 'domain_flight',
          },
          knownSlots: { destination: 'Rome' },
          confirmedFields: ['destination'],
          priorClarificationAttempts: [{ field: 'dates', count: 2 }],
        }),
      )
      expect(result.shouldAsk).toBe(true)
      expect(
        result.avoidReasons.some(
          (a) => a.field === 'dates' && a.reason === 'strategy_shift_examples',
        ),
      ).toBe(true)
      assertNoUserFacingCopy(result)
    })
  })

  describe('search eligibility + class API', () => {
    it('when search not eligible, clarification may be produced', () => {
      const result = planClarification(
        base({
          missing: {
            blocking: ['origin', 'dates'],
            deferrable: [],
            bookingOnly: [],
            confirmedFields: ['destination'],
            abort: false,
            goal: 'domain_flight',
          },
          knownSlots: { destination: 'Madrid' },
          confirmedFields: ['destination'],
          confidence: confidence({
            searchEligible: false,
            shouldClarify: true,
          }),
        }),
      )
      expect(result.planningHints.searchEligible).toBe(false)
      expect(result.shouldAsk).toBe(true)
      expect(result.mergedFields).toEqual(expect.arrayContaining(['origin', 'dates']))
    })

    it('class plan delegates to pure function; no gateway calls', async () => {
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

      const input = base({
        missing: {
          blocking: ['destination'],
          deferrable: [],
          bookingOnly: [],
          confirmedFields: [],
          abort: false,
          goal: 'explore',
        },
      })
      expect(createClarificationBridge().plan(input)).toEqual(planClarification(input))
      if (spy) expect(spy).not.toHaveBeenCalled()
    })
  })
})
