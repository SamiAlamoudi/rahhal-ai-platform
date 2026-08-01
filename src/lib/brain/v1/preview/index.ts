/**
 * Sprint 86 — Brain v1 Preview Integration public API.
 * Sprint 88 Task 2 — Preview Orchestrator (BrainRouter+) contracts (types only).
 */

export {
  BRAIN_V1_PREVIEW_FEATURE_ID,
  BRAIN_V1_PREVIEW_VERSION,
  isBrainV1PreviewEnabled,
  isBrainPreviewDeployTargetAllowed,
} from './feature'
export {
  routeBrainPreviewTurn,
  tryBrainV1PreviewTurn,
  type BrainRouterDecision,
  type BrainRouterInput,
  type BrainRouterPath,
} from './BrainRouter'
export { extractBrainPreviewSession } from './sessionStore'
export {
  PREVIEW_ORCHESTRATOR_CONTRACTS_VERSION,
  earlyReturnLockedHandoffHint,
  blockedInsufficientInformationHint,
  type PreviewConversationStage,
  type SearchHandoffHint,
  type PreviewOrchestratorTurnContract,
} from '../contracts/previewContracts'

/** Sprint 88 Task 5 — shadow telemetry (not wired into BrainRouter/planTurn). */
export {
  SHADOW_TELEMETRY_CONTRACT_VERSION,
  SHADOW_TELEMETRY_FORBIDDEN_KEYS,
  isForbiddenTelemetryKey,
  redactTelemetryRecord,
  sanitizeShadowTelemetryEvent,
  toLatencyBucket,
  createInMemoryShadowTelemetrySink,
  createShadowTelemetryEmitter,
  InMemoryShadowTelemetrySink,
  type ShadowPreviewTelemetryEvent,
  type ShadowTelemetryEmitter,
  type ShadowTelemetryEmitResult,
  type ShadowLatencyBucket,
  type ShadowResultStatus,
} from './telemetry'

/**
 * Sprint 88 Task 3 — memory adapters.
 * Sprint 89 Phase 1 — used by UnderstandingMemoryManager inside BrainRouter
 * when preview is enabled (still default OFF; no search/handoff).
 */
export {
  MEMORY_PROVENANCE_CONTRACT_VERSION,
  WORKING_MEMORY_ADAPTER_VERSION,
  USER_PREFERENCE_ADAPTER_VERSION,
  TRIP_MEMORY_ADAPTER_VERSION,
  WorkingMemoryAdapter,
  UserPreferenceAdapter,
  TripMemoryAdapter,
  createWorkingMemoryAdapter,
  createUserPreferenceAdapter,
  createTripMemoryAdapter,
  createMemoryFactProvenance,
  resolveProvenanceConflict,
  type MemoryProvenanceSource,
  type MemoryFactProvenance,
  type MemoryProvenanceMap,
  type WorkingMemorySnapshot,
  type UserPreferenceSnapshot,
  type TripMemorySnapshot,
} from './memory'
