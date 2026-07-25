# Tool Contracts — Phase 6 Stage 7

Architecture interfaces under `src/lib/orchestration/toolEngine/types.ts`.

## Core

| Contract | Role |
|----------|------|
| `ToolExecutionEngineContract` | Engine version marker (`execution: 'none'`) |
| `ToolExecutionPipelineContract` | Ordered stage ids |
| `ToolContract` | Per-capability input/output schema hints |
| `ToolMetadataContract` | Label, version hint, tags |
| `ToolRegistryEntry` | Registry row |
| `ToolCapabilityRegistryEntry` | Capability catalog row |

## Control plane

| Contract | Role |
|----------|------|
| `ToolRouterContract` | Capability → toolId route hints |
| `ToolDispatcherContract` | Sync/async dispatch mode hint |
| `ToolResolverContract` | Resolve tool id (null in blueprints) |
| `ToolDiscoveryContract` | Discovered placeholder tool ids |
| `ToolPermissionsContract` | Permission level (`none` by default) |
| `ToolPoliciesContract` | Deny-by-default policy hints |
| `ToolContextInjectionContract` | Session keys (empty in blueprints) |

## Quality & resilience

| Contract | Role |
|----------|------|
| `ToolInputValidationContract` | Input validity placeholder |
| `ToolOutputValidationContract` | Output validity placeholder |
| `ToolResultNormalizationContract` | Normalized shape hint |
| `ToolErrorModelContract` | Error codes / retryable hints |
| `ToolRetryStrategyContract` | `maxAttemptsHint: 0` |
| `ToolTimeoutStrategyContract` | `timeoutMsHint: 0` |
| `ToolCircuitBreakerContract` | State/threshold hints |
| `ToolQueueContract` | Empty queue items |

## Observability

| Contract | Role |
|----------|------|
| `ToolEventContract` | Session / lifecycle events |
| `ToolAnalyticsContract` | Counts; `exported: false` |
| `ToolAuditTrailContract` | Entries; `persisted: false` |
| `ToolStateMachineContract` | Allowed states; current `idle` |

## Aggregate

`ToolEngineBlueprint` — full architecture snapshot assembled by `buildToolEngineBlueprint`.
