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
