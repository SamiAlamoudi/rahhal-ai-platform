/**
 * Sprint 88 Task 2 — Brain preview / domain contracts (interfaces only).
 */

export {
  DOMAIN_INTELLIGENCE_CONTRACT_VERSION,
  domainIntelligenceNotImplemented,
  skippedDomainResult,
  type DomainIntelligence,
  type DomainIntelligenceId,
  type DomainFallbackMode,
  type DomainResultStatus,
  type DomainTimeoutPolicy,
  type DomainRetryPolicy,
  type DomainTelemetry,
  type DomainAssumption,
  type DomainExplainabilityNode,
  type DomainQueryBuildResult,
  type DomainQuerySkip,
  type DomainQueryReady,
  type DomainResult,
  type DomainPreferenceSnapshot,
  type RankedNormalizedOffer,
} from './domainIntelligence'

export {
  RANKING_CONFIG_CONTRACT_VERSION,
  DEFAULT_RANKING_CONFIG,
  EXTENDED_RANKING_WEIGHT_KEYS,
  mergeRankingConfig,
  sumCoreRankingDefaults,
  type CoreRankingWeightKey,
  type ExtendedRankingWeightKey,
  type RankingConfig,
} from './rankingConfig'

export {
  DEFAULT_OFFER_STALE_AFTER_MS,
  createNormalizedOfferSkeleton,
  emptyBaggageInfo,
  emptyCancellationPolicyInfo,
  emptyFareFamilyInfo,
  isNormalizedOfferStale,
  type NormalizedOffer,
  type NormalizedOfferKind,
  type FareFamilyInfo,
  type BaggageInfo,
  type CancellationPolicyInfo,
  type OfferMoney,
  type OfferProvenance,
} from './normalizedOffer'

export {
  PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
  earlyReturnLockedHandoffHint,
  blockedInsufficientInformationHint,
  type PreviewConversationStage,
  type SearchHandoffHint,
  type PreviewOrchestratorTurnContract,
} from './previewContracts'
