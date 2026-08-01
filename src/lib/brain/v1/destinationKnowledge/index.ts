/**
 * Sprint 87 — Destination Knowledge layer (public API).
 * Data-driven destination reasoning for Brain preview.
 */

import { ensureDestinationKnowledgeLoaded } from './data'
import {
  clearDestinationKnowledgeRegistryForTests,
  getDestinationKnowledgeByKey,
  listDestinationKnowledge,
  registerDestinationKnowledge,
  registerDestinationKnowledgeMany,
  resolveDestinationKnowledgeKey,
} from './registry'
import {
  buildDestinationReasoningLines,
  indicativeBudgetForSlots,
  inferTripStyle,
  readTaggedDuration,
  reasonFromDestinationKnowledge,
  resolveKnowledgeKey,
} from './reasonFromKnowledge'

ensureDestinationKnowledgeLoaded()

export type {
  AirportInfo,
  BudgetBandSar,
  CityKnowledge,
  DestinationKnowledge,
  DestinationReasoning,
  DurationBand,
  KnowledgeScore,
  LocalizedText,
  RankedCity,
  TripStyleHint,
} from './types'

export {
  ensureDestinationKnowledgeLoaded,
  registerDestinationKnowledge,
  registerDestinationKnowledgeMany,
  getDestinationKnowledgeByKey,
  listDestinationKnowledge,
  resolveDestinationKnowledgeKey,
  clearDestinationKnowledgeRegistryForTests,
  reasonFromDestinationKnowledge,
  resolveKnowledgeKey,
  inferTripStyle,
  readTaggedDuration,
  buildDestinationReasoningLines,
  indicativeBudgetForSlots,
}

export { resetDestinationKnowledgeBootstrapForTests } from './data'
