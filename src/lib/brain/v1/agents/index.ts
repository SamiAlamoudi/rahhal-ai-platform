/**
 * Sprint 83 — Bilamo Agent Orchestrator public API.
 * Feature flag: `ai.brain.v1` (OFF by default).
 */

export {
  BRAIN_AGENT_ORCHESTRATOR_VERSION,
  DEFAULT_AGENT_RETRY_POLICY,
  type BrainAgentId,
  type BrainAgentLifecycle,
  type BrainAgentFailureKind,
  type BrainAgentRetryPolicy,
  type BrainAgentSelection,
  type BrainAgentResult,
  type BrainAgentContextData,
  type BrainAgentTelemetryEvent,
  type BrainAgentOrchestratorTelemetry,
  type BrainAgentDefinition,
  type BrainAgentOrchestratorInput,
  type BrainAgentOrchestratorResult,
} from './types'

export { AgentRegistry, createAgentRegistry } from './AgentRegistry'
export { DependencyGraph, createDependencyGraph } from './DependencyGraph'
export { AgentLifecycleTracker, createAgentLifecycleTracker } from './AgentLifecycle'
export { AgentTelemetryCollector, createAgentTelemetryCollector } from './Telemetry'
export {
  resolveRetryPolicy,
  shouldRetry,
  withTimeout,
  classifyError,
} from './RetryPolicy'
export {
  AgentOrchestrator,
  createAgentOrchestrator,
  runBrainAgentOrchestrator,
  type AgentOrchestratorDeps,
} from './AgentOrchestrator'
export {
  DEFAULT_BRAIN_AGENTS,
  createEmptyAgentContextData,
  plannerAgent,
  memoryAgent,
  travelAgent,
  flightAgent,
  hotelAgent,
  packageAgent,
  weatherAgent,
  mapsAgent,
  visaAgent,
  pricingAgent,
  bookingAgent,
  safetyAgent,
  responseAgent,
} from './definitions'
