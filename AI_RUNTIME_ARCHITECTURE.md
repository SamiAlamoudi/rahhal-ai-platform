# Runtime Architecture — Phase 6 Stage 9

## Layers

| Layer | Contracts |
|-------|-----------|
| Orchestrator | `RuntimeOrchestratorContract` |
| Pipeline | Stages coordinating all seven engines |
| Session / Context | `ExecutionSessionContract` · `ExecutionContextContract` |
| Control | Coordinator · Scheduler · Queue · State machine |
| Policy | Guards · Middleware · Hooks · Recovery |
| Resilience | Retry · Timeout |
| Observability | Metrics · Analytics · Audit · Logging · Monitoring · Trace |
| Topology | `ExecutionDependencyGraphContract` |

## Dependency graph (declarative)

```
conversation_orchestrator
  → planning_engine
  → decision_engine
  → memory_engine
  → knowledge_engine
  → tool_engine
  → llm_adapter
```

Edges are architecture metadata only — no runtime wiring.

## Isolation

`RUNTIME_ORCHESTRATOR_ISOLATION` asserts **false** for production runtime, AI calls, provider SDKs, HTTP, streaming, tool execution, DB/Redis/Supabase/Firebase/Storage/Auth, and business logic.
