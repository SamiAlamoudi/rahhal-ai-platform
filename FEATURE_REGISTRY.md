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
| `ai.concierge` | experimental | yes | Provider-agnostic consultant dialogue above the agent |
| `ui.flight_results_experience` | beta | yes | Sprint 11 flight cards, sort/filter, details, select→session |
| `ui.passenger_booking_flow` | beta | yes | Sprint 12 passengers, validation, summary, session persist (depends on flight results) |
| `ui.my_trips` | beta | yes | Sprint 13 My Trips (alias: myTrips); depends on passenger booking flow |
| `ui.booking_history` | beta | yes | Sprint 13 booking records + concierge history (alias: bookingHistory) |
| `ui.booking_confirmation` | beta | yes | Sprint 14 confirmation engine + UI (alias: booking_confirmation) |
| `ui.supplier_adapter` | beta | yes | Sprint 14 supplier ports — Amadeus active (alias: supplier_adapter) |
| `ui.booking_timeline` | beta | yes | Sprint 14 confirmation timeline UI (alias: booking_timeline) |
| `ui.order_management` | beta | yes | Sprint 15 Order entity from confirmed bookings (alias: order_management) |
| `ui.checkout_review` | beta | yes | Sprint 15 checkout review page (alias: checkout_review) |
| `ui.payment_preparation` | beta | yes | Sprint 15 payment ports + sessions, mock only (alias: payment_preparation) |
| `ui.ai_home` | beta | yes | Sprint 16 conversation-first AI Home (alias: ai_home) |
| `ui.conversation_home` | beta | yes | Sprint 16 home → Chat seed entry (alias: conversation_home) |
| `ui.travel_cards` | beta | yes | Sprint 16 smart travel cards on Home (alias: travel_cards) |
| `ui.continue_booking` | beta | yes | Sprint 16 continue-booking panel (alias: continue_booking) |
| `ui.smart_itinerary` | beta | yes | Sprint 17 post-booking TripItinerary engine (alias: smart_itinerary) |
| `ui.travel_insights` | beta | yes | Sprint 17 travel insight cards (alias: travel_insights) |
| `ui.daily_planner` | beta | yes | Sprint 17 daily planner sections (alias: daily_planner) |
| `ui.voice_conversation` | experimental | **no** | Sprint 18 voice conversation foundation UI (alias: voice_conversation) |
| `voice.realtime` | experimental | **no** | Sprint 18 realtime transport gate — stubs only (alias: voice_realtime) |
| `voice.provider` | experimental | **no** | Sprint 18 provider abstraction gate (alias: voice_provider) |
| `voice.mock` | experimental | **no** | Sprint 18 mock voice provider harness (alias: voice_mock) |
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
