/**
 * Rahhal Brain Core v1 — public API.
 */

export { RahhalBrain, runRahhalBrainTurn } from './rahhalBrain'
export type { RahhalBrainHandle, RahhalBrainOptions } from './rahhalBrain'
export { createDefaultRahhalBrainPorts, buildMemoryFromMessages } from './defaultPorts'
export { understandConversation } from './conversationUnderstanding'
export { classifyBrainIntents } from './intentEngine'
export { buildInternalPlan } from './planningEngine'
export { reflectOnResponse } from './reflectionEngine'
export { composeBrainResponse, composeClarificationQuestion } from './responseComposer'
export { selectModulesToExecute } from './pipeline'
export { isRahhalBrainEnabled, RAHHAL_BRAIN_FEATURE_ID } from './feature'
export type { RahhalBrainPorts } from './ports'
export type {
  BrainModuleId,
  RahhalBrainIntentId,
  ConversationUnderstanding,
  BrainIntent,
  BrainIntentResult,
  InternalPlan,
  InternalPlanStep,
  ComposedResponse,
  RahhalBrainDecision,
  RahhalBrainDecisionType,
  RahhalBrainMetaSnapshot,
  RahhalBrainTurnInput,
  RahhalBrainTurnResult,
} from './types'
