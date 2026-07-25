# Context Validation — Phase 7 Stage 5

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `ContextValidationContract` / `ContextValidation` | `valid: true`, empty issues |
| `ContextMergeRulesContract` | prefer_session_over_stale · prefer_explicit_constraints · deny_memory_as_live_context |
| `ContextPrioritiesContract` | intent → goals → constraints → budget → trip → preferences → environment |
| `ContextFreshnessContract` | `freshnessBandHint: 'unknown'` |
| `ContextConfidence` | `bandHint: 'medium'`, `scoreHint: 0` |

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoLlms` | false |
| `wiredIntoRuntime` | false |
| `wiredIntoDatabase` | false |
| `wiredIntoStorage` | false |
| `httpRequests` | false |
| `wiredIntoApis` | false |
| `businessLogic` | false |
| `distinctFromMemoryEngine` | true |
| `distinctFromContextMemory` | true |

Force blueprint: `tryBuildTravelerContextEngineBlueprint({ enabled: true })`.
