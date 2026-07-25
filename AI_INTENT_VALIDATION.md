# Intent Validation — Phase 7 Stage 6

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `IntentValidationContract` / `IntentValidation` | `valid: true`, empty issues |
| `IntentPriorityRulesContract` | emergency / booking / explicit priority hints |
| `IntentResolutionRulesContract` | confidence / multi-intent / deny_unvalidated |

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
| `distinctFromSprint19BrainIntent` | true |

Force blueprint: `tryBuildIntentEngineBlueprint({ enabled: true })`.
