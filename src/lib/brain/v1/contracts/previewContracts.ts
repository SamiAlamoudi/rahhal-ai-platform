/**
 * Sprint 88 Task 2 — Preview Orchestrator (BrainRouter+) contracts.
 * Type surface only. Does not change BrainRouter runtime or flag defaults.
 *
 * Search Handoff implementation remains Sprint 90 (see ADR-SPRINT88-SEARCH-HANDOFF).
 */

import type { ConversationSession } from '../conversation/types'
import type { ExplainableRecommendation } from '../destinationKnowledge/types'

export const PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION =
  'sprint88-preview-orchestrator-1' as const

/**
 * Conceptual conversation stages (Architecture ADD §2.3).
 * Not yet driven by BrainRouter — optional meta for future soft-enrich.
 */
export type PreviewConversationStage =
  | 'idle'
  | 'greeting'
  | 'exploring'
  | 'refining'
  | 'searching'
  | 'comparing'
  | 'ready_for_booking'
  | 'paused'
  | 'recovered'
  | 'fallback'

/**
 * Hints for future Option A soft-enrich continue (ADR Task 1).
 * Sprint 88 runtime always behaves as early_return_locked when Brain succeeds.
 */
export type SearchHandoffHint =
  | {
      kind: 'early_return_locked'
      /** Current Sprint 88 / pre-Sprint 90 behavior */
      reason: 'preview_early_return_until_sprint90'
    }
  | {
      kind: 'blocked_insufficient_information'
      missingFields: string[]
      /**
       * Normative: planner must clarify; MUST NOT invoke Search or Provider Gateway.
       * @see docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md §3
       */
      mustNotInvokeSearchOrGateway: true
    }
  | {
      kind: 'soft_enrich_continue'
      /** Future Sprint 90 — only when sufficient information */
      eligible: true
    }
  | { kind: 'none' }

/** Additive preview turn contract (optional fields on providerMeta.brainV1Preview). */
export type PreviewOrchestratorTurnContract = {
  contractsVersion: typeof PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION
  stage?: PreviewConversationStage
  searchHandoffHint?: SearchHandoffHint
  /** Sidecar explainability (may already exist via ConversationManager result). */
  destinationExplainability?: ExplainableRecommendation | null
  session?: ConversationSession | null
}

/** Documented current lock value for tests and future BrainRouter+ wiring. */
export function earlyReturnLockedHandoffHint(): SearchHandoffHint {
  return {
    kind: 'early_return_locked',
    reason: 'preview_early_return_until_sprint90',
  }
}

export function blockedInsufficientInformationHint(
  missingFields: string[],
): SearchHandoffHint {
  return {
    kind: 'blocked_insufficient_information',
    missingFields: [...missingFields],
    mustNotInvokeSearchOrGateway: true,
  }
}
