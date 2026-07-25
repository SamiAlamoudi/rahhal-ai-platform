# Search Validation — Phase 7 Stage 8

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `SearchValidationContract` / `SearchValidation` | `valid: true`, empty issues |
| `SearchLifecycleContract` | prepare · map_providers · validate · snapshot · revise · close |
| `SearchRevisionContract` | empty revisions; `persisted: false` |

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoRuntime` | false |
| `httpRequests` | false |
| `wiredIntoSdks` | false |
| `wiredIntoProviderApis` | false |
| `wiredIntoDatabase` | false |
| `wiredIntoStorage` | false |
| `booking` | false |
| `pricing` | false |
| `wiredIntoLlms` | false |
| `distinctFromSprint24BrainSearch` | true |

Force blueprint: `tryBuildTravelSearchOrchestratorBlueprint({ enabled: true })`.
