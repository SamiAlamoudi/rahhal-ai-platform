/**
 * Sprint 89 Phase 1 — EntityExtractor with provenance tags.
 * Reuses foundation EntityExtractor rules; never emits assumptions as user_provided.
 * No booking-only fields forced (passport/payment absent).
 */

import {
  EntityExtractor as FoundationEntityExtractor,
  createEntityExtractor as createFoundationEntityExtractor,
} from '../EntityExtractor'
import { emptyBrainV1Entities, type BrainV1Entities } from '../types'
import type {
  EntityExtractorResult,
  EntityFactKind,
  ExtractedEntityFact,
  UnderstandingConfidence,
} from './types'
import { UNDERSTANDING_CONTRACT_VERSION } from './types'

const TRACKED_FIELDS: Array<keyof BrainV1Entities | 'travelDates.start' | 'travelDates.end'> = [
  'destination',
  'origin',
  'flexibleDates',
  'travelerCount',
  'adults',
  'children',
  'infants',
  'budget',
  'cabinClass',
  'preferredAirline',
  'hotelRating',
  'starLevel',
  'mealPreference',
  'transportation',
  'language',
  'currency',
  'nationality',
  'visaDestination',
  'travelDates.start',
  'travelDates.end',
]

function readField(entities: BrainV1Entities, field: string): unknown {
  if (field === 'travelDates.start') return entities.travelDates.start
  if (field === 'travelDates.end') return entities.travelDates.end
  if (field === 'activities') return entities.activities
  return entities[field as keyof BrainV1Entities]
}

function priorField(prior: Partial<BrainV1Entities> | undefined, field: string): unknown {
  if (!prior) return null
  if (field === 'travelDates.start') return prior.travelDates?.start ?? null
  if (field === 'travelDates.end') return prior.travelDates?.end ?? null
  if (field === 'activities') return prior.activities ?? []
  return prior[field as keyof BrainV1Entities] ?? null
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? []) === JSON.stringify(b ?? [])
  }
  return a === b
}

function confidenceForNewFact(field: string, text: string): UnderstandingConfidence {
  const lower = text.toLowerCase()
  // Explicit destination/origin cues → confirmed user_provided.
  if (field === 'destination' || field === 'origin') {
    return { level: 'confirmed', score: 0.95 }
  }
  if (field.startsWith('travelDates') && /\d{4}-\d{2}-\d{2}/.test(text)) {
    return { level: 'confirmed', score: 0.95 }
  }
  if (field === 'flexibleDates') {
    return { level: 'confirmed', score: 0.9 }
  }
  if (field === 'budget' || field === 'adults' || field === 'children' || field === 'travelerCount') {
    return { level: 'confirmed', score: 0.92 }
  }
  if (field === 'cabinClass' || field === 'currency' || field === 'nationality') {
    return { level: 'high_confidence_inferred', score: 0.8 }
  }
  if (/family|عائلة/.test(lower) && (field === 'adults' || field === 'children')) {
    return { level: 'medium_confidence_inferred', score: 0.6 }
  }
  return { level: 'high_confidence_inferred', score: 0.78 }
}

function kindForFact(confidence: UnderstandingConfidence): EntityFactKind {
  if (confidence.level === 'confirmed') return 'user_provided'
  if (confidence.level === 'assumption') return 'assumption'
  if (confidence.level === 'stale') return 'stale'
  if (confidence.level === 'conflicting') return 'inferred'
  return 'inferred'
}

export class ProvenancedEntityExtractor {
  private readonly foundation: FoundationEntityExtractor

  constructor(foundation: FoundationEntityExtractor = createFoundationEntityExtractor()) {
    this.foundation = foundation
  }

  /** Backward-compatible bare extract. */
  extract(text: string, prior?: Partial<BrainV1Entities>): BrainV1Entities {
    return this.foundation.extract(text, prior)
  }

  extractWithProvenance(
    text: string,
    prior?: Partial<BrainV1Entities>,
  ): EntityExtractorResult {
    const before = { ...emptyBrainV1Entities(), ...prior }
    before.travelDates = {
      start: prior?.travelDates?.start ?? null,
      end: prior?.travelDates?.end ?? null,
    }
    before.activities = [...(prior?.activities ?? [])]

    const entities = this.foundation.extract(text, prior)
    const facts: ExtractedEntityFact[] = []
    const revisedFields: string[] = []

    for (const field of TRACKED_FIELDS) {
      const next = readField(entities, field)
      const prev = priorField(prior, field)
      const empty =
        next == null
        || next === ''
        || (Array.isArray(next) && next.length === 0)
      if (empty) continue
      if (valuesEqual(next, prev)) continue

      const confidence = confidenceForNewFact(field, text)
      const kind = kindForFact(confidence)
      // Hard rule: never label assumption here — AssumptionEngine is Phase 2.
      let safeKind: EntityFactKind = kind === 'assumption' ? 'inferred' : kind
      // Prior non-empty value replaced → corrected (user wins).
      if (prev != null && prev !== '' && !valuesEqual(next, prev)) {
        safeKind = 'corrected'
        if (confidence.level !== 'confirmed') {
          confidence.level = 'confirmed'
          confidence.score = Math.max(confidence.score ?? 0.9, 0.9)
        }
      }
      facts.push({
        field,
        value: next,
        kind: safeKind,
        confidence,
        evidence: text.trim().slice(0, 120),
      })
      revisedFields.push(field)
    }

    if (entities.activities.length) {
      const prevActs = prior?.activities ?? []
      if (JSON.stringify(entities.activities) !== JSON.stringify(prevActs)) {
        if (!revisedFields.includes('activities')) {
          revisedFields.push('activities')
          facts.push({
            field: 'activities',
            value: entities.activities,
            kind: 'user_provided',
            confidence: { level: 'confirmed', score: 0.9 },
            evidence: text.trim().slice(0, 120),
          })
        }
      }
    }

    // Explicit clear: correction removed end date — emit a corrected null fact.
    const prevEnd = prior?.travelDates?.end ?? null
    if (
      prevEnd
      && entities.travelDates.end == null
      && revisedFields.includes('travelDates.start')
    ) {
      revisedFields.push('travelDates.end')
      facts.push({
        field: 'travelDates.end',
        value: null,
        kind: 'corrected',
        confidence: { level: 'confirmed', score: 0.95 },
        evidence: text.trim().slice(0, 120),
      })
    }

    return {
      contractVersion: UNDERSTANDING_CONTRACT_VERSION,
      entities,
      facts,
      revisedFields,
    }
  }
}

export function createProvenancedEntityExtractor(
  foundation?: FoundationEntityExtractor,
): ProvenancedEntityExtractor {
  return new ProvenancedEntityExtractor(foundation)
}

/** Alias matching AI Contracts naming. */
export { ProvenancedEntityExtractor as UnderstandingEntityExtractor }
