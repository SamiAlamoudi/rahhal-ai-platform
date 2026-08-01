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

export function understandTurn(
  input: UnderstandingTurnInput,
  deps: UnderstandTurnDeps = {},
): UnderstandingTurnResult {
  const intents = deps.intents ?? createIntentExtractor()
  const entities = deps.entities ?? createProvenancedEntityExtractor()
  const references = deps.references ?? createReferenceResolver()

  const intent = intents.extract(input.text)
  const entityResult = entities.extractWithProvenance(input.text, input.priorEntities)

  // Apply resolved destination references onto entities when destination missing.
  const hints = input.memoryHints ?? {}
  const refResult = references.resolve({
    text: input.text,
    destination: entityResult.entities.destination ?? hints.destination ?? null,
    origin: entityResult.entities.origin ?? hints.origin ?? null,
    budgetAmount: entityResult.entities.budget ?? hints.budgetAmount ?? null,
    budgetCurrency: entityResult.entities.currency ?? hints.budgetCurrency ?? null,
    hotelPreference: hints.hotelPreference ?? null,
    preferredAirline: entityResult.entities.preferredAirline ?? hints.preferredAirline ?? null,
    shortlistLabels: hints.shortlistLabels,
    recentTexts: hints.recentTexts,
  })

  let entitiesOut = entityResult
  for (const ref of refResult.resolved) {
    if (ref.field === 'trip.destination' && !entitiesOut.entities.destination) {
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

  const state = advanceUnderstandingState(input.priorState, {
    conversationId: input.conversationId,
    locale: input.locale,
    consultantIntent: intent.primaryIntent,
    hasAmbiguousReferences: refResult.ambiguous.length > 0,
    hasEntityRevisions: entitiesOut.revisedFields.length > 0,
  })

  const memoryProposals = entitiesOut.facts.map((fact) =>
    createMemoryFactProvenance({
      field: fact.field,
      value: fact.value,
      source: fact.kind === 'user_provided' ? 'user_stated' : 'system',
      confidence: fact.confidence.score ?? 0.7,
      planId: state.activeTripId,
      reversible: fact.kind !== 'user_provided',
    }),
  )

  const provenance = Object.fromEntries(memoryProposals.map((p) => [p.field, p]))

  return {
    contractVersion: UNDERSTANDING_CONTRACT_VERSION,
    intent,
    entities: entitiesOut,
    references: refResult,
    state,
    memoryProposals,
    provenance,
    summary: {
      consultantIntent: intent.primaryIntent,
      legacyIntent: intent.legacyIntent,
      entityFields: entitiesOut.revisedFields,
      resolvedReferenceCount: refResult.resolved.length,
      ambiguousReferenceCount: refResult.ambiguous.length,
      brainState: state.brainState,
    },
  }
}

export function createUnderstandTurn(deps?: UnderstandTurnDeps) {
  return (input: UnderstandingTurnInput) => understandTurn(input, deps)
}
