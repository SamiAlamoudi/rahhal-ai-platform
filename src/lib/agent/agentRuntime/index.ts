/**
 * Phase 6 — AI Agent Runtime & Tool Execution
 * Reuses conversationIntelligence + llmBrain. Mock tools only.
 */

export type {
  AgentRuntimeInput,
  AgentRuntimeMetaSnapshot,
  AgentRuntimeResult,
  RuntimeEvent,
  RuntimeEventType,
  RuntimeLocale,
  RuntimeToolId,
  SyncedRuntimeState,
  ToolExecutionRecord,
  ToolLifecycleStatus,
  VoiceRuntimeState,
  ExecutionTraceStep,
} from './types'

export { AGENT_RUNTIME_FEATURE_ID, isAgentRuntimeEnabled } from './feature'
export { ExecutionEvents } from './executionEvents'
export { ExecutionTrace } from './executionTrace'
export { ExecutionContext, RuntimeExecutionContext } from './executionContext'
export { AgentSession } from './agentSession'
export { ExecutionPipeline, runRuntimeExecutionPipeline } from './executionPipeline'
export { ExecutionResult, buildRuntimeExecutionResult } from './executionResult'
export {
  AgentRuntime,
  runAgentRuntime,
  getOrCreateAgentSession,
  resetAgentRuntimeSessions,
  PHASE6_AGENT_RUNTIME_VERSION,
} from './agentRuntime'
export { enrichWithAgentRuntime } from './enrich'
export {
  FlightSearchAdapter,
  HotelSearchAdapter,
  WeatherAdapter,
  VisaAdapter,
  CurrencyAdapter,
  MapsAdapter,
  RestaurantAdapter,
  ActivitiesAdapter,
  MOCK_TOOL_ADAPTERS,
} from './tools/mockAdapters'
export { executeRuntimeTool, mapDecisionToTool } from './tools/toolExecutor'
