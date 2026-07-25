/**
 * Integration Sprint 11 — Action Execution Layer barrel.
 * Feature-gated by `ai.integration_action_execution` (default OFF).
 */

export {
  INTEGRATION_ACTION_EXECUTION_VERSION,
  FUTURE_LIVE_ACTION_CAPABILITIES,
} from './types'
export type {
  ActionConfirmationGate,
  ActionConfirmationKind,
  ActionExecutionMemory,
  ActionExecutionMode,
  ActionExecutionResult,
  ActionExecutionResultPayload,
  ActionHistoryEntry,
  ActionIntent,
  ActionKind,
  ActionPipelineStage,
  ActionValidation,
  FutureLiveActionCapabilities,
  PendingAction,
} from './types'

export {
  INTEGRATION_ACTION_EXECUTION_FEATURE_ID,
  isIntegrationActionExecutionEnabled,
} from './feature'

export {
  detectActionIntent,
  detectActionKind,
  isActionAsk,
  confirmationKindFor,
} from './intents'

export { validateAction } from './validation'
export { buildConfirmationGate, requiresConfirmation } from './confirmation'
export {
  readActionMemory,
  writeActionMemory,
  resetActionMemoryForTests,
} from './memory'
export { executeActionSafely, describeFutureLiveSupport } from './execute'
export { buildActionExecutionSummary } from './consultant'

export {
  ActionEngine,
  createActionEngine,
  runActionExecution,
  type ActionExecutionDeps,
  type RunActionExecutionInput,
} from './engine'

export {
  enrichWithIntegrationActionExecution,
  shouldRunActionExecution,
  toActionExecutionMeta,
} from './enrich'
