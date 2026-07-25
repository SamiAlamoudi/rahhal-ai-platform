# Preference Validation — Phase 7 Stage 4

## Contracts

| Contract | Role |
|----------|------|
| `PreferenceValidationRulesContract` | Rule ids: require_category · require_evidence_hint · deny_empty_value |
| `PreferenceValidation` (output) | valid / issues placeholders |
| `PreferenceConflictResolverContract` | prefer_explicit · prefer_fresher · deny_unvalidated |
| `PreferenceMergeStrategyContract` | union_compatible · override_on_conflict_hint |

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoLlms` | false |
| `wiredIntoDatabase` | false |
| `wiredIntoStorage` | false |
| `wiredIntoRuntime` | false |
| `recommendationExecution` | false |
| `httpRequests` | false |
| `wiredIntoApis` | false |
| `businessLogic` | false |
| `formFillingRequired` | false |

Force blueprint: `tryBuildPreferenceExtractionBlueprint({ enabled: true })`.
