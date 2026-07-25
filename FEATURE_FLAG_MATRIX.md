# Feature Flag Matrix — RC1 (Sprint 18)

## Method

For every FeatureRegistry entry:

1. **OFF** — force disabled → `isEnabled` must be false  
2. **ON (test mode)** — enable dependencies then feature  
3. **Dependencies** — disabling a dependency must disable the dependent feature  
4. **Cross-leak** — enabling one flag must not enable unrelated critical OFF flags  

## Critical flags (must stay OFF by default)

| Flag | Default | RC1 posture |
|------|---------|-------------|
| `security.secret_manager` | OFF | OFF |
| `observability.platform` | OFF | OFF |
| `load_testing.platform` | OFF | OFF |
| `production_audit.platform` | OFF | OFF |
| `rc1.validation` | OFF | OFF |
| `ai.integration_journey` | OFF | OFF |
| `ai.integration_trip_orchestrator` | OFF | OFF |
| `ai.integration_action_execution` | OFF | OFF |
| `ai.live_providers` | OFF | OFF |
| `provider.amadeus` | OFF | OFF |
| `provider.duffel` | OFF | OFF |
| `provider.booking` | OFF | OFF |

## Compatibility

- No cross-feature leakage detected among critical flags.
- Dependency chains respected (`isEnabled` walks `dependsOn`).
- Full matrix rows generated at runtime by `buildFeatureFlagMatrix()` (100+ features).

## Result

**PASS** — flag matrix healthy; critical defaults OFF.
