# Conversation Validation — Phase 7 Stage 12

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `ConversationBrainValidationContract` / `ConversationBrainValidation` | `valid: true`, empty issues |
| `ConversationBrainLifecycleContract` | receive · advance · decide · validate · snapshot · revise · close |
| `ConversationBrainRevisionContract` | empty revisions; `persisted: false` |
| `ConversationBrainStrategyContract` | contract_coordination_only · never_execute_engines · never_call_providers · never_invoke_llm |

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoRuntime` | false |
| `wiredIntoLlms` | false |
| `httpRequests` | false |
| `wiredIntoProviderApis` | false |
| `bookingExecuted` | false |
| `wiredIntoDatabase` | false |
| `wiredIntoStorage` | false |
| `wiredIntoUi` | false |
| `enginesInvoked` | false |
| `businessLogicExecuted` | false |
| `distinctFromAgentConversationBrain` | true |
| `distinctFromBrainConversationOrchestrator` | true |
| `distinctFromAiConversationOrchestrator` | true |

Force blueprint: `tryBuildConversationBrainBlueprint({ enabled: true })`.
