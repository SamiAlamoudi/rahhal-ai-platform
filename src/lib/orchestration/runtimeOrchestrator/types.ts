/**
 * Phase 6 Stage 9 — AI Runtime Orchestrator contracts.
 * Architecture / interfaces / types / blueprints only.
 * No production runtime, APIs, SDKs, HTTP, or AI calls.
 */

export type RuntimeLocale = 'ar' | 'en'

export type RuntimeLifecycleAction =
  | 'start'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'rollback'
  | 'recovery'
  | 'completion'

export type RuntimeStateId =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'recovering'
  | 'rolling_back'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'closed'

export type RuntimeEventKind =
  | 'session_started'
  | 'pipeline_started'
  | 'pipeline_paused'
  | 'pipeline_resumed'
  | 'pipeline_cancelled'
  | 'pipeline_rolled_back'
  | 'pipeline_recovered'
  | 'pipeline_completed'
  | 'engine_coordinated'
  | 'guard_evaluated'
  | 'hook_invoked_hint'
  | 'middleware_hinted'
  | 'retry_scheduled'
  | 'timeout_hinted'
  | 'metric_recorded'
  | 'trace_appended'
  | 'audit_appended'
  | 'state_transition'
  | 'session_ended'

/** Engines coordinated by the runtime (architecture references only). */
export type RuntimeEngineRefId =
  | 'conversation_orchestrator'
  | 'planning_engine'
  | 'decision_engine'
  | 'memory_engine'
  | 'knowledge_engine'
  | 'tool_engine'
  | 'llm_adapter'

export type RuntimePipelineStageId =
  | 'attach_session'
  | 'load_context'
  | 'coordinate_conversation'
  | 'coordinate_planning'
  | 'coordinate_decision'
  | 'coordinate_memory'
  | 'coordinate_knowledge'
  | 'coordinate_tools'
  | 'coordinate_llm_adapter'
  | 'apply_guards'
  | 'apply_middleware'
  | 'invoke_hooks'
  | 'check_timeout'
  | 'apply_retry'
  | 'emit_metrics'
  | 'append_trace'
  | 'append_audit'
  | 'complete_or_recover'

export interface RuntimeOrchestratorContract {
  kind: 'runtime_orchestrator'
  version: '6.9.0-runtime-orchestrator'
  execution: 'none'
}

export interface ExecutionPipelineContract {
  kind: 'execution_pipeline'
  stages: readonly RuntimePipelineStageId[]
  execution: 'none'
}

export interface ExecutionContextContract {
  kind: 'execution_context'
  sessionId: string
  locale: RuntimeLocale
  engineRefs: readonly RuntimeEngineRefId[]
  execution: 'none'
}

export interface ExecutionLifecycleContract {
  kind: 'execution_lifecycle'
  actions: readonly RuntimeLifecycleAction[]
  currentActionHint: RuntimeLifecycleAction | null
  execution: 'none'
}

export interface ExecutionSessionContract {
  kind: 'execution_session'
  sessionId: string
  opened: boolean
  execution: 'none'
}

export interface ExecutionCoordinatorContract {
  kind: 'execution_coordinator'
  coordinatedEngines: readonly RuntimeEngineRefId[]
  execution: 'none'
}

export interface ExecutionSchedulerContract {
  kind: 'execution_scheduler'
  scheduleModeHint: 'sequential_placeholder' | 'parallel_placeholder'
  execution: 'none'
}

export interface ExecutionQueueContract {
  kind: 'execution_queue'
  items: readonly { id: string; stageHint: RuntimePipelineStageId; priorityHint: string }[]
  execution: 'none'
}

export interface ExecutionRegistryEntry {
  id: string
  engineRef: RuntimeEngineRefId
  featureIdHint: string
  enabledHint: false
}

export interface ExecutionContract {
  kind: 'execution_contract'
  contractId: string
  engineRef: RuntimeEngineRefId
  inputSchemaHint: string
  outputSchemaHint: string
  execution: 'none'
}

export interface ExecutionMiddlewareContract {
  kind: 'execution_middleware'
  middlewareIds: readonly string[]
  execution: 'none'
}

export interface ExecutionHooksContract {
  kind: 'execution_hooks'
  beforeHints: readonly string[]
  afterHints: readonly string[]
  execution: 'none'
}

export interface ExecutionGuardsContract {
  kind: 'execution_guards'
  guardIds: readonly string[]
  denyByDefault: true
  execution: 'none'
}

export interface ExecutionRecoveryContract {
  kind: 'execution_recovery'
  strategies: readonly string[]
  execution: 'none'
}

export interface ExecutionRetryStrategyContract {
  kind: 'execution_retry_strategy'
  maxAttemptsHint: number
  backoffHint: string
  execution: 'none'
}

export interface ExecutionTimeoutStrategyContract {
  kind: 'execution_timeout_strategy'
  timeoutMsHint: number
  execution: 'none'
}

export interface ExecutionMetricsContract {
  kind: 'execution_metrics'
  counters: readonly string[]
  recorded: false
}

export interface ExecutionAnalyticsContract {
  kind: 'execution_analytics'
  sessionId: string
  engineCount: number
  stageCount: number
  exported: false
}

export interface ExecutionAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface ExecutionAuditTrailContract {
  kind: 'execution_audit_trail'
  entries: readonly ExecutionAuditEntry[]
  persisted: false
}

export interface ExecutionLoggingContract {
  kind: 'execution_logging'
  levels: readonly string[]
  sinks: readonly string[]
  wired: false
}

export interface ExecutionMonitoringContract {
  kind: 'execution_monitoring'
  probes: readonly string[]
  wired: false
}

export interface ExecutionTraceSpan {
  spanId: string
  name: string
  engineRef: RuntimeEngineRefId | null
}

export interface ExecutionTraceModelContract {
  kind: 'execution_trace_model'
  spans: readonly ExecutionTraceSpan[]
  exported: false
}

export interface ExecutionDependencyEdge {
  from: RuntimeEngineRefId
  to: RuntimeEngineRefId
  relation: string
}

export interface ExecutionDependencyGraphContract {
  kind: 'execution_dependency_graph'
  nodes: readonly RuntimeEngineRefId[]
  edges: readonly ExecutionDependencyEdge[]
  execution: 'none'
}

export interface ExecutionEventContract {
  kind: 'execution_event'
  eventId: string
  eventKind: RuntimeEventKind
  sessionId: string
  atIso: string
  payloadSummary: string
}

export interface ExecutionStateTransition {
  from: RuntimeStateId
  to: RuntimeStateId
  reason: string
}

export interface ExecutionStateMachineContract {
  kind: 'execution_state_machine'
  current: RuntimeStateId
  allowed: readonly RuntimeStateId[]
  lastTransition: ExecutionStateTransition | null
  execution: 'none'
}

export interface RuntimeOrchestratorBlueprint {
  version: '6.9.0-runtime-orchestrator'
  featureId: 'brain.runtime_orchestrator'
  architectureOnly: true
  orchestrator: RuntimeOrchestratorContract
  pipeline: ExecutionPipelineContract
  context: ExecutionContextContract
  lifecycle: ExecutionLifecycleContract
  session: ExecutionSessionContract
  coordinator: ExecutionCoordinatorContract
  scheduler: ExecutionSchedulerContract
  queue: ExecutionQueueContract
  stateMachine: ExecutionStateMachineContract
  events: readonly ExecutionEventContract[]
  registry: readonly ExecutionRegistryEntry[]
  contracts: readonly ExecutionContract[]
  middleware: ExecutionMiddlewareContract
  hooks: ExecutionHooksContract
  guards: ExecutionGuardsContract
  recovery: ExecutionRecoveryContract
  retryStrategy: ExecutionRetryStrategyContract
  timeoutStrategy: ExecutionTimeoutStrategyContract
  metrics: ExecutionMetricsContract
  analytics: ExecutionAnalyticsContract
  auditTrail: ExecutionAuditTrailContract
  logging: ExecutionLoggingContract
  monitoring: ExecutionMonitoringContract
  traceModel: ExecutionTraceModelContract
  dependencyGraph: ExecutionDependencyGraphContract
  engineRefs: readonly RuntimeEngineRefId[]
  lifecycleActions: readonly RuntimeLifecycleAction[]
}

export const RUNTIME_ORCHESTRATOR_ISOLATION = {
  wiredIntoProductionRoutes: false,
  productionRuntime: false,
  wiredIntoOpenAi: false,
  wiredIntoClaude: false,
  wiredIntoGemini: false,
  wiredIntoProviderSdks: false,
  httpRequests: false,
  streamingImplemented: false,
  toolExecution: false,
  wiredIntoFirebase: false,
  wiredIntoSupabase: false,
  wiredIntoRedis: false,
  wiredIntoDatabase: false,
  wiredIntoStorage: false,
  wiredIntoAuth: false,
  aiCalls: false,
  businessLogic: false,
} as const

export const RUNTIME_ENGINE_REFS: readonly RuntimeEngineRefId[] = [
  'conversation_orchestrator',
  'planning_engine',
  'decision_engine',
  'memory_engine',
  'knowledge_engine',
  'tool_engine',
  'llm_adapter',
] as const

export const RUNTIME_LIFECYCLE_ACTIONS: readonly RuntimeLifecycleAction[] = [
  'start',
  'pause',
  'resume',
  'cancel',
  'rollback',
  'recovery',
  'completion',
] as const

export const RUNTIME_PIPELINE_STAGES: readonly RuntimePipelineStageId[] = [
  'attach_session',
  'load_context',
  'coordinate_conversation',
  'coordinate_planning',
  'coordinate_decision',
  'coordinate_memory',
  'coordinate_knowledge',
  'coordinate_tools',
  'coordinate_llm_adapter',
  'apply_guards',
  'apply_middleware',
  'invoke_hooks',
  'check_timeout',
  'apply_retry',
  'emit_metrics',
  'append_trace',
  'append_audit',
  'complete_or_recover',
] as const

export const RUNTIME_STATE_IDS: readonly RuntimeStateId[] = [
  'idle',
  'starting',
  'running',
  'paused',
  'recovering',
  'rolling_back',
  'cancelling',
  'completed',
  'failed',
  'closed',
] as const

export const RUNTIME_ENGINE_FEATURE_HINTS: Record<
  RuntimeEngineRefId,
  string
> = {
  conversation_orchestrator: 'brain.conversation_orchestrator',
  planning_engine: 'brain.planning_engine',
  decision_engine: 'brain.decision_engine',
  memory_engine: 'brain.memory_engine',
  knowledge_engine: 'brain.knowledge_engine',
  tool_engine: 'brain.tool_engine',
  llm_adapter: 'brain.llm_adapter',
}
