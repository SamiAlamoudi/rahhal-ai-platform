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
| `ai.travel_reasoning` | beta | yes | Sprint 45 open-ended destination reasoning + preference bridge (alias: travel_reasoning) |
| `ai.consultant_reasoning` | experimental | **no** | Evolution Sprint 1 consultant reasoning layer — offline, not wired to planTurn (alias: consultant_reasoning) |
| `ai.consultant_reflection` | experimental | **no** | Evolution Sprint 2 reflection layer — memory, incremental re-score, recommendation revision (alias: consultant_reflection) |
| `ai.planning_graph` | experimental | **no** | Evolution Sprint 4 multi-plan DAG — branch/merge/compare/reject/restore (alias: planning_graph) |
| `ai.traveler_intelligence` | experimental | **no** | Evolution Sprint 5 evolving behavioral traveler model — preferences/DNA/biases (alias: traveler_intelligence) |
| `ai.recommendation_intelligence` | experimental | **no** | Evolution Sprint 6 expert consultant recommendations — explain/compare/justify (alias: recommendation_intelligence) |
| `ai.destination_intelligence` | experimental | **no** | Evolution Sprint 7 consultant-grade destination knowledge — seasonality/matching/compare (alias: destination_intelligence) |
| `ai.travel_strategy` | experimental | **no** | Evolution Sprint 8 travel strategy optimization — timing/budget/comfort/route; does not pick destinations (alias: travel_strategy) |
| `ai.consultant_pipeline` | experimental | **no** | Phase 2 Stage 1–2 consultant pipeline — orchestrates existing layers; Stage 2 read-only enrich after planTurn when ON (alias: consultant_pipeline) |
| `ai.consultant_response` | experimental | **no** | Phase 2 Stage 3 unified consultant response — aggregates pipeline layers into executive/short/detailed/consultant formats (alias: consultant_response) |
| `ai.runtime_coordinator` | experimental | **no** | Phase 2 Stage 4 AI Runtime Coordinator — ordering/deps/cache/timeout/retry/isolation for consultant layers (alias: runtime_coordinator) |
| `ai.conversation_orchestrator` | experimental | **no** | Phase 3 Stage 1 Conversation Orchestrator — intent/memory/stage plan/reply above Runtime Coordinator (alias: conversation_orchestrator) |
| `ai.multi_turn_conversation` | experimental | **no** | Phase 3 Stage 2 Multi-Turn Conversation Manager — persistent dialogue continuity/memory/clarification/recovery (alias: multi_turn_conversation) |
| `ai.proactive_advisor` | experimental | **no** | Phase 3 Stage 3 Proactive Travel Advisor — opportunity tips via meta only (alias: proactive_advisor) |
| `ai.travel_intelligence` | experimental | **no** | Phase 3 Stage 4 Travel Intelligence — alternative compare/trade-off/rank via meta only; not wired into planTurn (alias: travel_intelligence) |
| `ai.experience_layer` | experimental | **no** | Phase 3 Stage 5 Experience Intelligence — UI-ready presentation models via meta.experience only; not wired into planTurn (alias: experience_layer) |
| `ai.smart_clarification` | beta | yes | Sprint 46 never-ask-twice soft preference inference (alias: smart_clarification) |
| `ai.persistent_memory` | beta | yes | Sprint 48 durable preference profiles via localStorage (alias: persistent_memory) |
| `ai.rahhal_brain` | beta | yes | Sprint 50 Rahhal Brain Core orchestration on production agent path (alias: rahhal_brain) |
| `ai.travel_executive` | beta | yes | Phase 2 AI Travel Executive — context, rejections, optimizer, consultant replies (alias: travel_executive) |
| `ai.real_world_intelligence` | beta | yes | Sprint 53 Real World Intelligence — live flight/hotel/weather/visa/event/safety/FX/transport/price-watch via providers (alias: real_world_intelligence) |
| `ai.executive_os` | beta | yes | Sprint 52 Executive Operating System — knowledge, optimizers, graph, prediction, negotiation, goals, strategy, explanation v2, self-review (alias: executive_os) |
| `ai.executive_platform` | beta | yes | Sprint 51 Executive Travel Platform — ten engines via RahhalBrain (alias: executive_platform) |
| `ui.flight_results_experience` | beta | yes | Sprint 11 flight cards, sort/filter, details, select→session |
| `ui.passenger_booking_flow` | beta | yes | Sprint 12 passengers, validation, summary, session persist (depends on flight results) |
| `ui.my_trips` | beta | yes | Sprint 13 My Trips (alias: myTrips); depends on passenger booking flow |
| `ui.booking_history` | beta | yes | Sprint 13 booking records + concierge history (alias: bookingHistory) |
| `ui.booking_confirmation` | beta | yes | Sprint 14 confirmation engine + UI (alias: booking_confirmation) |
| `ui.supplier_adapter` | beta | yes | Sprint 14 supplier ports — Amadeus active (alias: supplier_adapter) |
| `ui.booking_timeline` | beta | yes | Sprint 14 confirmation timeline UI (alias: booking_timeline) |
| `ui.booking_flow` | experimental | **no** | Sprint 25 production booking flow orchestration (alias: booking_flow) |
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
| `brain.enabled` | experimental | **no** | Sprint 19 AI Travel Brain orchestration (alias: brain_enabled) |
| `brain.memory` | experimental | **no** | Sprint 19 conversation memory slots (alias: brain_memory) |
| `brain.intent` | experimental | **no** | Sprint 19 travel intent classifier (alias: brain_intent) |
| `brain.planner` | experimental | **no** | Sprint 19 response / travel planner (alias: brain_planner) |
| `brain.debug` | experimental | **no** | Sprint 19 debug panel UI (alias: brain_debug) |
| `brain.concierge` | experimental | **no** | Sprint 20 Brain ↔ Concierge / planTurn wiring (alias: brain_concierge) |
| `brain.agent_handoff` | experimental | **no** | Sprint 20 merge Brain slots into agent requirements (alias: brain_agent_handoff) |
| `brain.voice` | experimental | **no** | Sprint 20 Brain on voice transcripts (alias: brain_voice) |
| `brain.travel_engine` | experimental | **no** | Sprint 21 real travel conversation engine (alias: brain_travel_engine) |
| `brain.trip_planning` | experimental | **no** | Sprint 22 multi-step trip planning engine (alias: brain_trip_planning) |
| `brain.execution` | experimental | **no** | Sprint 23 travel execution engine (alias: brain_execution) |
| `brain.search` | experimental | **no** | Sprint 24 search aggregation engine (alias: brain_search) |
| `brain.real_providers` | experimental | **no** | Sprint 26 real/mixed execution providers (alias: brain_real_providers) |
| `brain.trip_orchestrator` | experimental | **no** | Sprint 27 AI Trip Orchestrator (alias: brain_trip_orchestrator) |
| `brain.context_memory` | experimental | **no** | Sprint 28 Conversation Memory & Context Engine (alias: brain_context_memory) |
| `brain.unified_travel_planner` | experimental | **no** | Sprint 31 Unified Travel Planning Engine (alias: unified_travel_planner) |
| `brain.conversation_ui` | experimental | **no** | Sprint 32 AI Conversation Experience (alias: conversation_ui) |
| `brain.travel_execution_engine` | experimental | **no** | Sprint 33 booking Travel Execution Engine (alias: travel_execution_engine) — depends on `brain.conversation_ui`; distinct from Sprint 23 `brain.execution` |
| `brain.payments_platform` | experimental | **no** | Sprint 34 Payments & Checkout Platform (alias: payments_platform) — depends on `brain.travel_execution_engine`; distinct from hosted `src/lib/payment` / deprecated `payments.live` |
| `brain.trip_management` | experimental | **no** | Sprint 35 Post Booking & Trip Management (alias: trip_management) — depends on `brain.payments_platform`; extends existing `src/lib/trips` TripManager |
| `brain.refund_policy_engine` | experimental | **no** | Sprint 36 Universal Cancellation & Refund Policy Engine (alias: refund_policy_engine) — depends on `brain.trip_management` |
| `brain.travel_disruption_engine` | experimental | **no** | Sprint 37 Travel Disruption & Smart Recovery Engine (alias: travel_disruption_engine) — depends on `brain.refund_policy_engine` |
| `brain.loyalty_platform` | experimental | **no** | Sprint 38 Universal Loyalty, Rewards & Membership Platform (alias: loyalty_platform) — depends on `brain.travel_disruption_engine` |
| `brain.travel_documents` | experimental | **no** | Sprint 39 Universal Travel Documents & Visa Intelligence Platform (alias: travel_documents) — depends on `brain.loyalty_platform` |
| `brain.supplier_marketplace` | experimental | **no** | Sprint 40 Universal Supplier Marketplace & Contract Platform (alias: supplier_marketplace) — depends on `brain.travel_documents` |
| `brain.finance_platform` | experimental | **no** | Sprint 41 Universal Revenue, Finance & Settlement Platform (alias: finance_platform) — depends on `brain.supplier_marketplace` |
| `ui.conversation_experience` | experimental | **no** | Sprint 42 Conversation Experience & Booking UX (alias: conversation_experience) — depends on `brain.conversation_ui`; presentation only over Sprint 32–35 engines |
| `brain.ai_orchestrator` | experimental | **no** | Sprint 43 Rahhal AI Orchestrator & Tool Routing (alias: ai_orchestrator) — depends on `brain.conversation_ui`, `brain.finance_platform` |
| `ui.chatgpt_experience` | experimental | **no** | Sprint 44 ChatGPT-like Conversation Experience (alias: chatgpt_experience) — depends on `ui.conversation_experience`; memory/intent/plan/tool-routing/streaming/voice UX only — no new travel engines |
| `ui.application_shell` | experimental | **no** | Phase 4 Stage 1 Premium Application Shell — navigation/design/theme/localization foundation; not wired into production routes (alias: application_shell) |
| `ui.conversation_center` | experimental | **no** | Phase 4 Stage 2 Premium AI Conversation Center — chat UI architecture only; depends on `ui.application_shell`; not wired into production / Runtime Coordinator / Orchestrator (alias: conversation_center) |
| `providers.hotel_foundation` | experimental | **no** | Sprint 30 Hotel Provider Foundation — sandbox Hotelbeds / Expedia Rapid / Booking Connectivity (alias: hotel_provider_foundation) |
| `payments.live` | deprecated | **no** | Keep mock payment until freeze lifts |
| `providers.live_master` | stable | **no** | Mirrors safe default; Phase W still authoritative |

## Usage

```ts
import { getFeatureRegistry } from '../lib/ai'
// or from app code: import { getFeatureRegistry } from '@/lib/ai' (if path alias configured)

const registry = getFeatureRegistry()
if (registry.isEnabled('ai.personalization')) {
  // load PreferenceEngine
}
```

**RC (`1.1.0-rc.1`):** Sprint 42–44 flags (`ui.conversation_experience`, `brain.ai_orchestrator`, `ui.chatgpt_experience`) remain experimental and default **OFF**. Production chat uses the stable `/chat` agent path without those gates.

Dependency rule: a feature is enabled only if it is marked `enabled` **and** all `dependsOn` features are enabled.

## Payment / provider safety

- Do not enable `payments.live` while `VITE_PAYMENT_PROVIDER` must remain `mock`.
- Do not treat this registry as a substitute for Edge secrets or Phase W live flags.
