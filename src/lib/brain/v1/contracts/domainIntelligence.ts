/**
 * Sprint 88 Task 2 — DomainIntelligence shared contract (interfaces only).
 * Implementations (execute → providerGateway) are Sprint 90+.
 * See Architecture ADD §5.
 */

import type { ProviderGateway } from '../../../../core/providerGateway'
import type { AgentMemory } from '../../../agent/types'
import type { ExplainableRecommendation } from '../destinationKnowledge/types'
import type { RankingConfig } from './rankingConfig'
import type { NormalizedOffer } from './normalizedOffer'

export const DOMAIN_INTELLIGENCE_CONTRACT_VERSION = 'sprint88-domain-intelligence-1' as const

export type DomainIntelligenceId =
  | 'flight'
  | 'hotel'
  | 'car'
  | 'activity'
  | 'visa'
  | 'package'
  | 'budget'
  | 'pricing'

export type DomainFallbackMode = 'skip_domain' | 'indicative_only' | 'clarify_once'

export type DomainResultStatus = 'ok' | 'partial' | 'skipped' | 'error'

export type DomainTimeoutPolicy = {
  softMs: number
  hardMs: number
}

export type DomainRetryPolicy = {
  /** Idempotent reads only. */
  max: number
  /** Backoff label — implementations choose strategy later. */
  backoff: 'none' | 'linear' | 'exponential'
}

export type DomainTelemetry = {
  domain: DomainIntelligenceId
  latencyMs: number | null
  partial: boolean
  /** Sanitized class only — never secrets or raw provider payloads. */
  errorClass: string | null
}

export type DomainAssumption = {
  field: string
  value: string
  reversible: boolean
  source: 'user' | 'assumed' | 'provider' | 'memory'
}

export type DomainExplainabilityNode = {
  domain: DomainIntelligenceId
  /** Destination-style explainability may be reused; domain-specific nodes later. */
  recommendation: ExplainableRecommendation | null
  whyTop: string[]
  alternatives: string[]
}

export type DomainQuerySkip = { skip: true; reason: string }
export type DomainQueryReady<TQuery> = { skip: false; query: TQuery }
export type DomainQueryBuildResult<TQuery> = DomainQuerySkip | DomainQueryReady<TQuery>

export type RankedNormalizedOffer = {
  offer: NormalizedOffer
  score: number
  rank: number
  reasons: string[]
}

export type DomainResult<TOffer = NormalizedOffer> = {
  status: DomainResultStatus
  offers: TOffer[]
  ranked: RankedNormalizedOffer[]
  explainability: DomainExplainabilityNode | null
  assumptions: DomainAssumption[]
  /** Sanitized error classes only. */
  errors: string[]
  provenance: {
    providerIds: string[]
    fetchedAt: string | null
  }
  telemetry: DomainTelemetry
}

export type DomainPreferenceSnapshot = {
  cabinClass?: string | null
  preferredAirlines?: string[]
  hotelStarMin?: number | null
  maxStops?: number | null
  refundablePreferred?: boolean
  tripPurpose?: string | null
  currency?: string | null
}

/**
 * Shared domain module contract. Sprint 88: type surface only.
 * `execute` must use `src/core/providerGateway` when implemented (Sprint 90+).
 */
export interface DomainIntelligence<TQuery = unknown, TOffer = NormalizedOffer> {
  readonly id: DomainIntelligenceId
  readonly timeouts: DomainTimeoutPolicy
  readonly retry: DomainRetryPolicy
  readonly fallback: DomainFallbackMode

  buildQuery(
    plan: unknown,
    memory: AgentMemory,
    prefs: DomainPreferenceSnapshot,
  ): DomainQueryBuildResult<TQuery>

  execute(
    query: TQuery,
    gateway: ProviderGateway,
  ): Promise<DomainResult<TOffer>>

  rank(
    offers: TOffer[],
    prefs: DomainPreferenceSnapshot,
    weights: RankingConfig,
  ): RankedNormalizedOffer[]

  explain(ranked: RankedNormalizedOffer[]): DomainExplainabilityNode
}

/**
 * Marker that Sprint 88 has no product DomainIntelligence implementations.
 * Calling this is a programming error — domains are not wired yet.
 */
export function domainIntelligenceNotImplemented(
  id: DomainIntelligenceId,
): never {
  throw new Error(
    `DomainIntelligence '${id}' is not implemented (Sprint 88 contracts only; execute deferred to Sprint 90+)`,
  )
}

/** Empty skipped result helper for future adapters / tests. */
export function skippedDomainResult(
  id: DomainIntelligenceId,
  reason: string,
): DomainResult {
  return {
    status: 'skipped',
    offers: [],
    ranked: [],
    explainability: null,
    assumptions: [],
    errors: [reason],
    provenance: { providerIds: [], fetchedAt: null },
    telemetry: {
      domain: id,
      latencyMs: 0,
      partial: false,
      errorClass: 'skipped',
    },
  }
}
