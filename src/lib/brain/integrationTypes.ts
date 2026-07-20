/**
 * Leaf types for brain integration — no orchestrator imports.
 * Breaks integration.ts ↔ aiTripOrchestrator.ts static type cycle.
 */

import type { AgentLocale, TripRequirements } from '../agent/types'
import type { BrainLocale } from './types'

export type RunIntegratedBrainTurnInput = {
  conversationId: string
  userText: string
  locale?: AgentLocale | BrainLocale
  /** Optional agent requirements used to seed brain memory before the turn. */
  requirements?: TripRequirements | null
  /** Sprint 21 — force travel engine on/off (otherwise FeatureRegistry). */
  travelEngine?: boolean
  /** Sprint 22 — force trip planning on/off (otherwise FeatureRegistry). */
  tripPlanning?: boolean
  /** Sprint 23 — force execution on/off (otherwise FeatureRegistry). */
  execution?: boolean
  /** Sprint 24 — force search aggregation on/off (otherwise FeatureRegistry). */
  search?: boolean
  signal?: AbortSignal
}
