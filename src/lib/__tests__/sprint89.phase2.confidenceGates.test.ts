/**
 * Sprint 89 Phase 2 T4 — ConfidenceGates (pure functions).
 * No Search / ProviderGateway / BrainRouter / CM / flags.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { emptyKnownSlots } from '../brain/v1/understanding'
import type { ConversationKnownSlots } from '../brain/v1/understanding/types'
import {
  CONFIDENCE_GATES_VERSION,
  createConfidenceGates,
  evaluateConfidenceGates,
  scoreToConfidenceLevel,
  type ConfidenceDecision,
  type ConfidenceGateInput,
} from '../brain/v1/planning/phase2'
import type { MissingInformationResult } from '../brain/v1/planning/phase2/MissingInformationPlanner'

function slots(partial: Partial<ConversationKnownSlots> = {}): ConversationKnownSlots {
  return { ...emptyKnownSlots(), ...partial }
}

function missing(
  partial: Partial<
    Pick<
      MissingInformationResult,
      'blocking' | 'deferrable' | 'bookingOnly' | 'goal' | 'abort' | 'sufficientForSearch'
    >
  > = {},
): ConfidenceGateInput['missing'] {
  return {
    blocking: [],
    deferrable: [],
    bookingOnly: ['passport', 'payment'],
    goal: 'domain_flight',
    abort: false,
    sufficientForSearch: false,
    ...partial,
  }
}

function base(
  overrides: Omit<Partial<ConfidenceGateInput>, 'knownSlots' | 'missing'> & {
    knownSlots?: Partial<ConversationKnownSlots>
    missing?: ConfidenceGateInput['missing']
  } = {},
): ConfidenceGateInput {
  const { knownSlots: slotPartial, missing: missingPartial, ...rest } = overrides
  return {
    knownSlots: slots(slotPartial),
    confirmedFields: [],
    assumedFields: [],
    missing: missingPartial ?? missing(),
    ambiguousFields: [],
    conflictingFields: [],
    correctedFields: [],
    fieldConfidence: {},
    abort: false,
    priorDecision: null,
    locale: 'en',
    ...rest,
  }
}

describe('Sprint 89 Phase 2 T4 — ConfidenceGates', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  it('exposes version and remains pure (no gateway)', async () => {
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

    const decision = evaluateConfidenceGates(
      base({
        knownSlots: {
          destination: 'Dubai',
          origin: 'Riyadh',
          startDate: '2026-10-01',
        },
        confirmedFields: ['destination', 'origin', 'dates'],
        missing: missing({ goal: 'domain_flight', sufficientForSearch: true }),
      }),
    )
    expect(decision.contractVersion).toBe(CONFIDENCE_GATES_VERSION)
    expect(spy).toBeNull()
    if (spy) expect(spy).not.toHaveBeenCalled()
  })

  describe('confirmed inputs', () => {
    it('en: confirmed O/D/dates → searchEligible, no clarify', () => {
      const decision = evaluateConfidenceGates(
        base({
          locale: 'en',
          knownSlots: {
            destination: 'Morocco',
            origin: 'Jeddah',
            startDate: '2026-11-01',
            endDate: '2026-11-08',
          },
          confirmedFields: ['destination', 'origin', 'dates', 'startDate', 'endDate'],
          missing: missing({ goal: 'domain_flight', sufficientForSearch: true }),
        }),
      )
      expect(decision.confidenceLevel).toBe('confirmed')
      expect(decision.searchEligible).toBe(true)
      expect(decision.shouldClarify).toBe(false)
      expect(decision.blockingReason).toBeNull()
    })

    it('ar: confirmed destination for advise → not searchEligible', () => {
      const decision = evaluateConfidenceGates(
        base({
          locale: 'ar',
          knownSlots: { destination: 'دبي' },
          confirmedFields: ['destination'],
          missing: missing({ goal: 'advise', sufficientForSearch: false }),
        }),
      )
      expect(decision.searchEligible).toBe(false)
      expect(decision.shouldClarify).toBe(false)
      expect(decision.confidenceLevel).toBe('confirmed')
    })
  })

  describe('assumed inputs', () => {
    it('assumed flexibleDates never enables search alone', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: { destination: 'Paris', origin: 'Riyadh' },
          confirmedFields: ['destination', 'origin'],
          assumedFields: ['flexibleDates', 'dates', 'adults'],
          missing: missing({ goal: 'domain_flight', blocking: [] }),
          fieldConfidence: { dates: 'assumption' },
        }),
      )
      expect(decision.searchEligible).toBe(false)
      expect(decision.blockingReason).toBe('assumption_insufficient_for_search')
    })

    it('assumed adults with confirmed O/D/dates still searchEligible', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: {
            destination: 'Tokyo',
            origin: 'Riyadh',
            startDate: '2026-05-01',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          assumedFields: ['adults'],
          missing: missing({ goal: 'domain_flight' }),
        }),
      )
      expect(decision.searchEligible).toBe(true)
      expect(decision.shouldClarify).toBe(false)
    })
  })

  describe('ambiguity', () => {
    it('en: ambiguous destination ⇒ shouldClarify, ¬searchEligible', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: {
            destination: 'Georgia',
            origin: 'Riyadh',
            startDate: '2026-09-01',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          ambiguousFields: ['destination'],
          missing: missing({ goal: 'domain_flight' }),
        }),
      )
      expect(decision.shouldClarify).toBe(true)
      expect(decision.searchEligible).toBe(false)
      expect(decision.blockingReason).toBe('ambiguous_values')
    })

    it('ar: ambiguous origin ⇒ shouldClarify', () => {
      const decision = evaluateConfidenceGates(
        base({
          locale: 'ar',
          knownSlots: {
            destination: 'دبي',
            origin: 'الرياض',
            startDate: '2026-12-01',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          ambiguousFields: ['origin'],
          missing: missing({ goal: 'search' }),
        }),
      )
      expect(decision.shouldClarify).toBe(true)
      expect(decision.searchEligible).toBe(false)
    })
  })

  describe('conflicting corrections', () => {
    it('conflicting fields always shouldClarify and block search', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: { destination: 'Dubai', origin: 'Riyadh', startDate: '2026-10-01' },
          confirmedFields: ['destination', 'origin', 'dates'],
          conflictingFields: ['destination'],
          missing: missing({ goal: 'domain_flight' }),
        }),
      )
      expect(decision.confidenceLevel).toBe('conflicting')
      expect(decision.shouldClarify).toBe(true)
      expect(decision.searchEligible).toBe(false)
      expect(decision.blockingReason).toBe('conflicting_values')
    })

    it('correction invalidates prior medium dates → recomputes as confirmed', () => {
      const prior: ConfidenceDecision = {
        contractVersion: CONFIDENCE_GATES_VERSION,
        confidenceLevel: 'medium_confidence_inferred',
        searchEligible: false,
        shouldClarify: true,
        blockingReason: 'medium_confidence_dates',
      }
      const after = evaluateConfidenceGates(
        base({
          knownSlots: {
            destination: 'Dubai',
            origin: 'Riyadh',
            startDate: '2026-11-15',
          },
          confirmedFields: ['destination', 'origin', 'dates', 'startDate'],
          correctedFields: ['dates', 'startDate'],
          fieldConfidence: { dates: 'medium_confidence_inferred' }, // stale prior hint
          priorDecision: prior,
          missing: missing({ goal: 'domain_flight' }),
        }),
      )
      // Correction wins — medium fieldConfidence ignored for corrected dates.
      expect(after.searchEligible).toBe(true)
      expect(after.confidenceLevel).toBe('confirmed')
      expect(after.shouldClarify).toBe(false)
      expect(after.blockingReason).toBeNull()
    })
  })

  describe('medium / high / low confidence', () => {
    it('medium-confidence dates NEVER enable search', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: {
            destination: 'London',
            origin: 'Riyadh',
            startDate: '2026-06-01',
          },
          confirmedFields: ['destination', 'origin'],
          fieldConfidence: { dates: 'medium_confidence_inferred', startDate: 'medium_confidence_inferred' },
          missing: missing({ goal: 'domain_flight', blocking: [] }),
        }),
      )
      expect(decision.searchEligible).toBe(false)
      expect(decision.blockingReason).toBe('medium_confidence_dates')
      expect(decision.shouldClarify).toBe(true)
    })

    it('high_confidence_inferred on allowlist can enable search', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: {
            destination: 'Madrid',
            origin: 'Riyadh',
            startDate: '2026-07-01',
          },
          confirmedFields: [],
          fieldConfidence: {
            destination: 'high_confidence_inferred',
            origin: 'high_confidence_inferred',
            dates: 'high_confidence_inferred',
          },
          missing: missing({ goal: 'domain_flight' }),
        }),
      )
      expect(decision.searchEligible).toBe(true)
      expect(decision.confidenceLevel).toBe('high_confidence_inferred')
      expect(decision.shouldClarify).toBe(false)
    })

    it('low/unknown required fields block search and clarify', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: { destination: 'Rome' },
          confirmedFields: ['destination'],
          missing: missing({
            goal: 'domain_flight',
            blocking: ['origin', 'dates'],
          }),
          fieldConfidence: { origin: 'unknown', dates: 'unknown' },
        }),
      )
      expect(decision.searchEligible).toBe(false)
      expect(decision.shouldClarify).toBe(true)
      expect(decision.blockingReason).toBe('low_or_unknown_required')
    })

    it('scoreToConfidenceLevel companions match bands (level wins elsewhere)', () => {
      expect(scoreToConfidenceLevel(0.8)).toBe('high_confidence_inferred')
      expect(scoreToConfidenceLevel(0.6)).toBe('medium_confidence_inferred')
      expect(scoreToConfidenceLevel(0.2)).toBe('unknown')
    })
  })

  describe('booking-only ignored', () => {
    it('passport/payment ambiguity never influences gates', () => {
      const decision = evaluateConfidenceGates(
        base({
          knownSlots: {
            destination: 'Cairo',
            origin: 'Riyadh',
            startDate: '2026-08-01',
          },
          confirmedFields: ['destination', 'origin', 'dates', 'passport'],
          ambiguousFields: ['passport', 'payment'],
          conflictingFields: ['payment_consent'],
          missing: missing({
            goal: 'domain_flight',
            bookingOnly: ['passport', 'payment', 'payment_consent'],
            blocking: ['passport'],
          }),
        }),
      )
      // booking-only stripped from blocking/ambiguous/conflict
      expect(decision.searchEligible).toBe(true)
      expect(decision.shouldClarify).toBe(false)
      expect(decision.blockingReason).toBeNull()
    })
  })

  describe('abort / recovery', () => {
    it('abort preserves prior confidence level and disables search/clarify', () => {
      const prior: ConfidenceDecision = {
        contractVersion: CONFIDENCE_GATES_VERSION,
        confidenceLevel: 'confirmed',
        searchEligible: true,
        shouldClarify: false,
        blockingReason: null,
      }
      const decision = evaluateConfidenceGates(
        base({
          abort: true,
          priorDecision: prior,
          knownSlots: { destination: 'Morocco' },
          confirmedFields: ['destination'],
          missing: missing({ abort: true, goal: 'domain_flight', blocking: ['origin', 'dates'] }),
          ambiguousFields: ['destination'],
        }),
      )
      expect(decision.confidenceLevel).toBe('confirmed')
      expect(decision.searchEligible).toBe(false)
      expect(decision.shouldClarify).toBe(false)
      expect(decision.blockingReason).toBe('abort_preserves_state')
    })

    it('recovery recomputes from current slots without prior medium leakage', () => {
      const recovered = evaluateConfidenceGates(
        base({
          knownSlots: {
            destination: 'Istanbul',
            origin: 'Jeddah',
            startDate: '2026-09-10',
          },
          confirmedFields: ['destination', 'origin', 'dates'],
          correctedFields: ['destination'],
          priorDecision: {
            contractVersion: CONFIDENCE_GATES_VERSION,
            confidenceLevel: 'medium_confidence_inferred',
            searchEligible: false,
            shouldClarify: true,
            blockingReason: 'medium_confidence_dates',
          },
          missing: missing({ goal: 'domain_flight' }),
        }),
      )
      expect(recovered.searchEligible).toBe(true)
      expect(recovered.confidenceLevel).toBe('confirmed')
      expect(recovered.shouldClarify).toBe(false)
    })

    it('class evaluate delegates to pure function', () => {
      const gates = createConfidenceGates()
      const input = base({
        knownSlots: { destination: 'Bali' },
        confirmedFields: ['destination'],
        missing: missing({ goal: 'explore' }),
      })
      expect(gates.evaluate(input)).toEqual(evaluateConfidenceGates(input))
    })
  })
})
