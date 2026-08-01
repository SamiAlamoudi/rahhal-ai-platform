/**
 * Sprint 89 Phase 1 — Understanding pipeline orchestration.
 * Intent → Entity (provenance) → Reference → ConversationState → memory proposals.
 * No ClarificationPolicy / Reasoner / ToolDecision / Search (Phase 2+).
 */

import { createMemoryFactProvenance } from '../preview/memory'
import { advanceUnderstandingState } from './ConversationState'
import { createIntentExtractor, type IntentExtractor } from './IntentExtractor'
import {
  createProvenancedEntityExtractor,
  type ProvenancedEntityExtractor,
} from './EntityExtractor'
import { createReferenceResolver, type ReferenceResolver } from './ReferenceResolver'
import type { UnderstandingTurnInput, UnderstandingTurnResult } from './types'
import { UNDERSTANDING_CONTRACT_VERSION } from './types'

export type UnderstandTurnDeps = {
  intents?: IntentExtractor
  entities?: ProvenancedEntityExtractor
  references?: ReferenceResolver
}

function priorFieldValue(
  prior: UnderstandingTurnInput['priorEntities'],
  field: string,
): unknown {
  if (!prior) return null
  if (field === 'travelDates.start') return prior.travelDates?.start ?? null
  if (field === 'travelDates.end') return prior.travelDates?.end ?? null
  return prior[field as keyof NonNullable<typeof prior>] ?? null
}

export function understandTurn(
  input: UnderstandingTurnInput,
  deps: UnderstandTurnDeps = {},
): UnderstandingTurnResult {
  const intents = deps.intents ?? createIntentExtractor()
  const entities = deps.entities ?? createProvenancedEntityExtractor()
  const references = deps.references ?? createReferenceResolver()

  const intent = intents.extract(input.text)

  // Abort/cancel: do not extract/apply destructive entity writes; preserve prior understanding.
  if (intent.primaryIntent === 'abort') {
    const preserved = entities.extractWithProvenance('', input.priorEntities)
    // Guarantee zero writes from the abort utterance itself.
    preserved.facts = []
    preserved.revisedFields = []

    const state = advanceUnderstandingState(input.priorState, {
      conversationId: input.conversationId,
      locale: input.locale,
      consultantIntent: 'abort',
      hasAmbiguousReferences: false,
      hasEntityRevisions: false,
      entities: preserved.entities,
      revisedFields: [],
    })

    return {
      contractVersion: UNDERSTANDING_CONTRACT_VERSION,
      intent,
      entities: preserved,
      references: { contractVersion: UNDERSTANDING_CONTRACT_VERSION, resolved: [], ambiguous: [] },
      state,
      memoryProposals: [],
      provenance: {},
      summary: {
        consultantIntent: intent.primaryIntent,
        legacyIntent: intent.legacyIntent,
        entityFields: [],
        resolvedReferenceCount: 0,
        ambiguousReferenceCount: 0,
        brainState: state.brainState,
      },
    }
  }

  const entityResult = entities.extractWithProvenance(input.text, input.priorEntities)
  const hints = input.memoryHints ?? {}

  // Prefer this-turn entities over memory hints so corrections beat stale memory.
  const refResult = references.resolve({
    text: input.text,
    destination: entityResult.entities.destination ?? hints.destination ?? null,
    origin: entityResult.entities.origin ?? hints.origin ?? null,
    budgetAmount: entityResult.entities.budget ?? hints.budgetAmount ?? null,
    budgetCurrency: entityResult.entities.currency ?? hints.budgetCurrency ?? null,
    hotelPreference: hints.hotelPreference ?? null,
    preferredAirline: entityResult.entities.preferredAirline ?? hints.preferredAirline ?? null,
    shortlistLabels: hints.shortlistLabels,
    // On correction, drop recent texts that would revive superseded destinations.
    recentTexts: intent.isCorrection || entityResult.revisedFields.includes('destination')
      ? []
      : hints.recentTexts,
  })

  let entitiesOut = entityResult
  const revisedSet = new Set(entityResult.revisedFields)

  for (const ref of refResult.resolved) {
    // Never let a reference re-introduce a stale destination when this turn set one.
    if (ref.field === 'trip.destination') {
      if (revisedSet.has('destination') && entitiesOut.entities.destination) {
        continue
      }
      if (
        entitiesOut.entities.destination
        && ref.resolvesTo
        && ref.resolvesTo !== entitiesOut.entities.destination
      ) {
        // Stale ref conflicts with current entity — ignore.
        continue
      }
      if (!entitiesOut.entities.destination && ref.resolvesTo) {
        entitiesOut = {
          ...entitiesOut,
          entities: { ...entitiesOut.entities, destination: ref.resolvesTo },
          facts: [
            ...entitiesOut.facts,
            {
              field: 'destination',
              value: ref.resolvesTo,
              kind: ref.confidence.level === 'confirmed' ? 'user_provided' : 'inferred',
              confidence: ref.confidence,
              evidence: ref.phrase,
            },
          ],
          revisedFields: [...entitiesOut.revisedFields, 'destination'],
        }
      }
    }
  }

  // Drop stale resolved refs that disagree with final entities (for callers/tests).
  const cleanedResolved = refResult.resolved.filter((ref) => {
    if (ref.field === 'trip.destination' && entitiesOut.entities.destination) {
      return ref.resolvesTo === entitiesOut.entities.destination
    }
    return true
  })
  const referencesOut = {
    ...refResult,
    resolved: cleanedResolved,
  }

  const state = advanceUnderstandingState(input.priorState, {
    conversationId: input.conversationId,
    locale: input.locale,
    consultantIntent: intent.primaryIntent,
    hasAmbiguousReferences: referencesOut.ambiguous.length > 0,
    hasEntityRevisions: entitiesOut.revisedFields.length > 0,
    entities: entitiesOut.entities,
    revisedFields: entitiesOut.revisedFields,
  })

  const memoryProposals = entitiesOut.facts.map((fact) => {
    const previousValue = priorFieldValue(input.priorEntities, fact.field)
    const corrected =
      fact.kind === 'corrected'
      || (previousValue != null
        && previousValue !== ''
        && previousValue !== fact.value)
    return createMemoryFactProvenance({
      field: fact.field,
      value: fact.value,
      source: 'user_stated',
      confidence: fact.confidence.score ?? 0.7,
      planId: state.activeTripId,
      reversible: false,
      previousValue: corrected ? previousValue : undefined,
      corrected: corrected || undefined,
    })
  })

  const provenance = Object.fromEntries(memoryProposals.map((p) => [p.field, p]))

  return {
    contractVersion: UNDERSTANDING_CONTRACT_VERSION,
    intent,
    entities: entitiesOut,
    references: referencesOut,
    state,
    memoryProposals,
    provenance,
    summary: {
      consultantIntent: intent.primaryIntent,
      legacyIntent: intent.legacyIntent,
      entityFields: entitiesOut.revisedFields,
      resolvedReferenceCount: referencesOut.resolved.length,
      ambiguousReferenceCount: referencesOut.ambiguous.length,
      brainState: state.brainState,
    },
  }
}

export function createUnderstandTurn(deps?: UnderstandTurnDeps) {
  return (input: UnderstandingTurnInput) => understandTurn(input, deps)
}
