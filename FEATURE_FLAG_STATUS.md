# Feature Flag Status — RC2 GA Review

## Policy

- Critical / experimental / live / integration flags: **OFF by default**
- Safe rollout: enable one flag at a time in staging with mock→live progression
- Rollback: disable flag via FeatureRegistry + redeploy; mock providers remain default
- Ownership: see table (Release Engineering owns review/harness flags)

## Critical flags (must stay OFF)

| Flag | Default | Ownership | Rollback |
|------|---------|-----------|----------|
| `security.secret_manager` | OFF | Security / Platform | Keep OFF until runbooks |
| `observability.platform` | OFF | Platform / Ops | Disable flag |
| `load_testing.platform` | OFF | Release Engineering | Disable flag |
| `production_audit.platform` | OFF | Release Engineering | Disable flag |
| `rc1.validation` | OFF | Release Engineering | Disable flag |
| `soak.staging` | OFF | Release Engineering | Disable flag |
| `rc2.ga_review` | OFF | Release Engineering | Disable flag |
| `ai.integration_*` (all) | OFF | Integration | Disable flag |
| `ai.live_providers` | OFF | Providers | Disable + mock defaults |
| `ai.live_flight_search` | OFF | Providers | Disable flag |
| `ai.live_hotel_search` | OFF | Providers | Disable flag |
| `ai.live_provider_gateway` | OFF | Providers | Disable flag |
| `provider.amadeus` | OFF | Providers | Disable flag |
| `provider.duffel` | OFF | Providers | Disable flag |
| `provider.booking` | OFF | Providers | Disable flag |
| `payments.live` | OFF | Payments | Disable flag |
| `providers.live_master` | OFF | Providers | Disable flag |
| `ai.realtime_voice` / `voice.realtime` | OFF | Voice | Disable flag |

## Warning

| Flag | Note |
|------|------|
| `providers.amadeus.enabled` | Registry default `true`; production helper blocks live URLs / production targets. Keep `provider.amadeus` + live search flags OFF for GA default. |

## Documentation / ownership

- Matrix evidence: `FEATURE_FLAG_MATRIX.md` (RC1) + `npm run rc2:review`
- Registry source: `src/lib/ai/featureFlags/featureRegistry.ts`
- Product aliases recorded in each feature `notes` field

## Result

**PASS** — critical defaults OFF; `rc2.ga_review` registered OFF; rollback paths documented.
