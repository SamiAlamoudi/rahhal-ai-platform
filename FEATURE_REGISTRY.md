# Feature Registry — Phase AB

Product feature flags live in `src/lib/ai/featureFlags` via `FeatureRegistry`.

This registry is **distinct** from Phase W `ProviderFeatureFlags` (provider live/mock controls).

## Lifecycles

| Lifecycle | Meaning |
|-----------|---------|
| `experimental` | Early foundation; may change; default off or narrowly on in library only |
| `beta` | Usable in staging with monitoring; APIs additive |
| `stable` | Production-safe with documented defaults |
| `deprecated` | Kept for compatibility; do not enable without migration plan |

## Registered features (defaults)

| Feature ID | Lifecycle | Default enabled | Notes |
|------------|-----------|-----------------|-------|
| `ai.multi_destination` | beta | yes | Outline helper for multi-city trips |
| `ai.alternative_itineraries` | experimental | yes | Depends on recommendation engine |
| `ai.confidence_scoring` | beta | yes | Planning + ranking confidence |
| `ai.explainable_recommendations` | beta | yes | whySelected / whyRejected |
| `ai.preference_weighting` | experimental | yes | Depends on personalization |
| `ai.personalization` | experimental | yes | Profile foundation |
| `ai.recommendation_engine` | experimental | yes | Engine interfaces |
| `ai.analytics` | experimental | yes | Privacy-gated anonymous metrics |
| `payments.live` | deprecated | **no** | Keep mock payment until freeze lifts |
| `providers.live_master` | stable | **no** | Mirrors safe default; Phase W still authoritative |

## Usage

```ts
import { getFeatureRegistry } from './lib/ai'

const registry = getFeatureRegistry()
if (registry.isEnabled('ai.personalization')) {
  // load PreferenceEngine
}
```

Dependency rule: a feature is enabled only if it is marked `enabled` **and** all `dependsOn` features are enabled.

## Payment / provider safety

- Do not enable `payments.live` while `VITE_PAYMENT_PROVIDER` must remain `mock`.
- Do not treat this registry as a substitute for Edge secrets or Phase W live flags.
