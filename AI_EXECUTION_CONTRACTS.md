# Execution Contracts — Phase 6 Stage 9

Architecture interfaces under `src/lib/orchestration/runtimeOrchestrator/types.ts`.

## Core

| Contract | Role |
|----------|------|
| `RuntimeOrchestratorContract` | Engine version marker |
| `ExecutionPipelineContract` | Ordered stage ids |
| `ExecutionContextContract` | Session + engine refs |
| `ExecutionLifecycleContract` | Lifecycle action catalog |
| `ExecutionSessionContract` | Session open hint (`false`) |
| `ExecutionCoordinatorContract` | Coordinated engine list |
| `ExecutionSchedulerContract` | Sequential/parallel hint |
| `ExecutionQueueContract` | Empty queue items |
| `ExecutionRegistryEntry` | Per-engine registry row |
| `ExecutionContract` | Per-engine I/O schema hints |

## Policy & resilience

| Contract | Role |
|----------|------|
| `ExecutionMiddlewareContract` | Middleware id hints |
| `ExecutionHooksContract` | Before/after hook hints |
| `ExecutionGuardsContract` | Deny-by-default guards |
| `ExecutionRecoveryContract` | Recovery strategy hints |
| `ExecutionRetryStrategyContract` | `maxAttemptsHint: 0` |
| `ExecutionTimeoutStrategyContract` | `timeoutMsHint: 0` |

## Observability

| Contract | Role |
|----------|------|
| `ExecutionMetricsContract` | Counter names; `recorded: false` |
| `ExecutionAnalyticsContract` | Counts; `exported: false` |
| `ExecutionAuditTrailContract` | Entries; `persisted: false` |
| `ExecutionLoggingContract` | Levels/sinks; `wired: false` |
| `ExecutionMonitoringContract` | Probes; `wired: false` |
| `ExecutionTraceModelContract` | Spans; `exported: false` |
| `ExecutionEventContract` | Lifecycle events |
| `ExecutionStateMachineContract` | Allowed states; current `idle` |
| `ExecutionDependencyGraphContract` | Nodes + edges |

## Aggregate

`RuntimeOrchestratorBlueprint` — full architecture snapshot from `buildRuntimeOrchestratorBlueprint`.
