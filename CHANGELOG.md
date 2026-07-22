# Changelog

All notable changes to Rahhal are documented in this file.

Canonical V1 GA + post-GA rollup: [`docs/CHANGELOG_V1.md`](docs/CHANGELOG_V1.md).  
Product QA: [`docs/QA0_PRODUCT_AUDIT.md`](docs/QA0_PRODUCT_AUDIT.md).

## [Unreleased] — Sprint 112: AI Memory & Personalization Engine

### Added

- AI Memory Engine (`src/lib/agent/memory/`) — preference extraction, persistent profile store, conversation memory, travel history, preference resolution/scoring, and metadata for Concierge / Response Composer consumers.
- Feature flag `ai.memory_engine` (**default OFF**).
- Docs: `docs/SPRINT112_MEMORY_ENGINE.md`; verify: `npm run memory:verify`.

### Notes

- Additive only — does not modify Decision Engine, Provider Gateway, Trip Builder, or Response Composer. Distinct from legacy `memory.ts` intake helpers (import via `memory/index`). Flag OFF preserves identical legacy behavior.

## [Unreleased] — Sprint 111: AI Concierge Experience (Decision Conversation Layer)

### Added

- Decision conversation layer (`src/lib/agent/concierge`) — sits after Response Composer: explanations, tradeoffs, what-if scenarios (no re-search), savings analysis, narration, and conversation metadata.
- Reuses feature flag `ai.concierge_experience` (Sprint 96 registry; Sprint 111 runner is additive and inert until called).
- Docs: `docs/SPRINT111_CONCIERGE_EXPERIENCE.md`; verify: `npm run concierge:verify`.

### Notes

- Additive only — does not modify Decision Engine, Provider Gateway, Trip Builder, or Response Composer contracts. Flag OFF disables the Sprint 111 runner enhancement path.

## [Unreleased] — Sprint 110: AI Trip Builder (Production)

### Added

- AI Trip Builder (`src/lib/agent/tripBuilder`) — combines live flight + hotel offers into complete trip recommendations with cost, savings, travel quality, confidence, explanations, and ranking groups.
- Feature flag `ai.trip_builder` (**default OFF**).
- Decision Engine adapters (`flightOffers` / `hotelStays` prioritized) and Response Composer packages (`responseComposerPackages` / `responseComposerInput`) without modifying those engines.
- Docs: `docs/SPRINT110_TRIP_BUILDER.md`; verify: `npm run trip-builder:verify`.

### Notes

- Additive only — does not modify Provider Gateway, Live Flight Search, Live Hotel Search, Decision Engine, or Response Composer. Flag OFF preserves identical legacy behavior.

## [Unreleased] — Sprint 109: Live Hotel Search (Amadeus Hotels)

### Added

- Live Hotel Search bridge (`src/lib/agent/liveHotelSearch`) — validate → compose → Provider Gateway → Amadeus hotel availability → `HotelOffer[]` with ranking groups.
- Additive `createAmadeusHotelSearchProvider` (hotels only; flight provider unchanged).
- Feature flag `ai.live_hotel_search` (**default OFF**).
- Docs: `docs/SPRINT109_LIVE_HOTEL_SEARCH.md`; verify: `npm run live-hotel-search:verify`.

### Notes

- Availability only — no booking. Flag OFF preserves identical legacy hotel paths. Does not modify Decision Engine, Response Composer, or UI.

## [Unreleased] — Sprint 106: AI Response Composer

### Added

- AI Response Composer (`src/lib/agent/responseComposer`) — executive summary, recommendations, alternatives, confidence, travel insights, booking/fare/layover warnings from provider facts only.
- Feature flag `ai.response_composer` (**default OFF**).
- Docs: `docs/SPRINT106_RESPONSE_COMPOSER.md`; verify: `npm run response-composer:verify`.

### Notes

- Additive presentation only — does not modify engines, Provider Gateway, Live Flight Search, or UI. Flag OFF preserves identical legacy behavior.

## [Unreleased] — Sprint 105: Live Flight Search (Amadeus Production Bridge)

### Added

- Live Flight Search bridge (`src/lib/agent/liveFlightSearch`) — validate → compose → Provider Gateway → Amadeus Flight Offers → Rahhal flight offers for Decision Engine.
- Feature flag `ai.live_flight_search` (**default OFF**).
- Additive request fields: children, cabin, maxResults, nonStop through Gateway + Amadeus adapter.
- Docs: `docs/SPRINT105_LIVE_FLIGHT_SEARCH.md`; verify: `npm run live-flight-search:verify`.

### Notes

- Additive only — reuses Sprint 104 Gateway + Sprint 92 Amadeus OAuth. No engine/UI redesign. Flag OFF preserves identical legacy search behavior.

## [Unreleased] — Sprint 104: Live Provider Integration (Production Phase 1)

### Added

- Provider Gateway (`src/core/providerGateway`) — single gateway, registry (Amadeus Phase 1), health monitor, availability, unified request/response, retry/timeout/rate-limit, metrics, error translation, structured logging.
- Agent bridge `runLiveProviderGateway` — gated by `ai.live_provider_gateway` (**default OFF**).
- Docs: `docs/SPRINT104_PROVIDER_GATEWAY.md`; verify: `npm run provider-gateway:verify`.

### Notes

- Additive only — reuses Sprint 90 readiness + Sprint 92 Amadeus adapter. No engine, booking, or UI redesign. Flag OFF preserves identical legacy provider behavior.

## [Unreleased] — Sprint 103: Alpha Integration & End-to-End Experience

### Added

- Alpha Integration connector (`src/lib/alphaIntegration`) — journey stages, route aliases (`/new-chat`, `/booking`), single meta→booking compose mapping, next-step resolver, flag report, graceful degradation helpers.
- Chat `AlphaJourneyPanel` CTA to Booking Assistant review when ready; confirmation page link to My Trips.
- Feature aliases: `ai.live_conversation`, `ai.my_trips_dashboard`.
- Docs: `docs/SPRINT103_ALPHA_INTEGRATION.md`; verify: `npm run alpha-integration:verify`.

### Notes

- Integration only — no new AI engines, no architecture redesign, no provider/booking-engine changes. Flags OFF preserve legacy routes.

## [Unreleased] — Sprint 102: Booking Execution & Confirmation

### Added

- Booking Execution & Confirmation (`src/core/bookingExecutionConfirmation`) — review model, traveler validation, abstract `BookingProviderAdapter`, Book Now workflow, lifecycle states, confirmation model.
- UI: `/booking-assistant/review` and `/booking-assistant/confirmation/:bookingId` (additive; legacy booking routes unchanged).
- Feature flag `ai.booking_execution_confirmation` (default ON).
- Docs: `docs/SPRINT102_BOOKING_EXECUTION_CONFIRMATION.md`; verify: `npm run booking-execution:verify`.

### Notes

- Extends Booking Assistant only. Abstract adapter + stub for tests/demos — no provider-specific booking implementation. Flag OFF redirects to legacy booking paths.

## [Unreleased] — Sprint 101: Smart Booking Assistant

### Added

- Smart Booking Assistant (`src/core/bookingAssistant`) — readiness, checklist, missing requirements, timeline, evidence-only warnings, next actions, reused confidence, booking summary.
- Agent bridge `assembleBookingAssistant` — attaches `meta.bookingAssistant` after Alpha Experience when `ai.booking_assistant` is ON.
- Docs: `docs/SPRINT101_BOOKING_ASSISTANT.md`; verify: `npm run booking-assistant:verify`.

### Notes

- Presentation / orchestration only — composes existing Alpha + engine snapshots. No engine, provider, booking, search, decision, or package changes. Flag OFF preserves legacy exactly.

## [Unreleased] — Sprint 99: Alpha Experience Assembly

### Added

- Alpha Experience Assembly (`src/core/alphaExperience`) — `AlphaExperienceComposer`, traveler journey / recommendation / summary builders, section priority + omission, unified `AlphaExperienceDTO`.
- Agent bridge `assembleAlphaTravelerExperience` — attaches `meta.alphaTravelerExperience` when `ai.alpha_experience` is ON.
- Docs: `docs/SPRINT99_ALPHA_EXPERIENCE_ASSEMBLY.md`; verify: `npm run alpha-experience:verify` (Sprint 91 + 99).

### Notes

- Presentation / orchestration only — consumes existing concierge + engine snapshots. No engine, provider, booking, search, or decision changes. Flag OFF preserves legacy exactly.

## [Unreleased] — Sprint 97: AI Concierge UI Integration

### Added

- Concierge conversation pipeline integration (`src/lib/agent/conciergeIntegration`) — UI DTOs, serializers for Conversation / Recommendation / Trip responses, engine-snapshot adapters, `integrateConciergeIntoTurn`.
- `travelAgentService.planTurn` attaches `conciergeExperience` + `conciergeRecommendation` meta and feeds recommendation facts when `ai.concierge_experience` is ON.
- Docs: `docs/SPRINT97_CONCIERGE_INTEGRATION.md`; verify: `npm run concierge-integration:verify`.

### Notes

- Presentation/integration only — no RahhalBrain redesign, no engine or booking logic changes. Flag off preserves legacy responses.

## [Unreleased] — Sprint 96: AI Concierge Experience

### Added

- Core Concierge Experience (`src/core/conciergeExperience`) — recommendation timeline, explanation engine, alternative scenarios, confidence indicator, conversation summary, comparison cards, proactive suggestions, ConciergeComposer.
- Agent bridge `src/lib/agent/conciergeExperience` + flag `ai.concierge_experience` (default ON).
- Docs: `docs/SPRINT96_AI_CONCIERGE.md`; verify: `npm run concierge-experience:verify`.

### Notes

- Additive presentation layer only — reuses existing trip/offer/decision facts without redesigning engines, Alpha Experience, Unified Trip, or Booking Orchestrator.

## [Unreleased] — Sprint 95: Release Stabilization & CI/CD Hardening

### Changed

- CI / Preview / Production-readiness workflows: concurrency cancel-in-progress; lockfile-faithful `npm ci`; PR gates use `npm run test` (non-watch).
- `package.json`: `npm test` → `vitest run` (CI-safe); added `test:watch` and `release:verify`.
- `vercel.json`: explicit `installCommand: npm ci` so production builds follow `package-lock.json`.

### Notes

- No new product features. No engine / booking / Unified Trip / provider behavior changes.
- Release readiness report: `docs/SPRINT95_RELEASE_READINESS.md`.

## [Unreleased] — Sprint 94: Live Booking Orchestrator

### Added

- Core booking workflow (`src/core/booking`) — BookingOrchestrator, plan, session, states, executor, validator, recovery (Retry/CircuitBreaker), audit, serializer.
- Agent bridge `src/lib/agent/bookingOrchestrator` + flag `booking.orchestrator` (default ON).
- Placeholder hotel / transfer / insurance reservations; flight hold path production-ready for provider adapters.
- Docs: `docs/SPRINT94_BOOKING_ORCHESTRATOR.md`; verify: `npm run booking-orchestrator:verify`.

### Notes

- Additive only — converts an approved bookable Trip into an executable booking workflow without modifying Unified Trip or existing engines.
- Consumes Unified Trip via `toBookableTrip` (Sprint 93 ↔ 94 bridge); plain `BookableTrip` callers remain supported.

## [Unreleased] — Sprint 93: Unified Travel Intelligence

### Added

- Core Trip composition (`src/core/trip`) — TripComposer, normalizer adapters, cost calculator, timeline, summaries, confidence, alternatives, validation, serialization.
- Agent bridge `src/lib/agent/unifiedTrip` + flag `ai.unified_trip` (default ON).
- Placeholder segments for hotels / activities / transfers / visa / insurance when live providers are absent.
- Docs: `docs/SPRINT93_UNIFIED_TRIP.md`; verify: `npm run unified-trip:verify`.

### Notes

- Additive only — existing engines and providers unchanged. Rahhal returns one presentation-ready Trip instead of isolated search results.

## [Unreleased] — Sprint 92: Amadeus Sandbox TravelProvider

### Added

- Amadeus Sandbox provider (`src/core/amadeusSandbox`) implementing Sprint 90 `TravelProvider` — OAuth lifecycle, flight search, airport lookup, airline/currency/passenger normalization, observability events.
- Agent bridge `src/lib/agent/providers/amadeusSandbox` + flag `providers.amadeus.enabled` (ON in sandbox, OFF in production).
- Docs: `docs/SPRINT92_AMADEUS_SANDBOX.md`; verify: `npm run amadeus-sandbox:verify`.

### Notes

- Additive only — Provider Readiness sources and AI engines unchanged. Hotels out of scope.
- Registers via `registerAmadeusSandboxProvider` / `createAmadeusSandboxRegistry`; reuses RetryPolicy, CircuitBreaker, and Registry failover.
- Additive adapters `toUnifiedTripFlightOffer` / `toBookableFlightSegment` for Sprint 93 Unified Trip and Sprint 94 Booking Orchestrator (no engine redesign).

## [Unreleased] — Sprint 91: Production Alpha Experience

### Added

- Core Alpha Experience (`src/core/alphaExperience`) — ConversationOrchestrator, thinking timeline, recommendation presenter, confidence aggregation, explanation layer, alternative scenarios, recoverable error copy, observability events.
- Agent bridge `src/lib/agent/alphaExperience` + flag `ai.alpha_experience` (default ON).
- Docs: `docs/SPRINT91_ALPHA_EXPERIENCE.md`; verify: `npm run alpha-experience:verify`.

### Notes

- Additive experience layer only — reuses Constitution, search plans, provider readiness, packages, refinement, and Decision Engine without redesign.
- Existing `travelAgentService` path unchanged; orchestrator is the end-to-end Alpha entry point.

## [Unreleased] — Sprint 84: Autonomous Itinerary Refinement Engine

### Added

- Core refinement stack (`src/core/itineraryRefinement`) — incremental constraint resolution, schedule/transfer optimization, conflict detection, alternatives A/B/C, explainability.
- Agent bridge `src/lib/agent/itineraryRefinement` + flag `ai.itinerary_refinement` (default ON).
- Feeds Adaptive Learning; Decision Engine consumes refined offer pools (no DE contract change).
- Docs: `docs/SPRINT84_ITINERARY_REFINEMENT.md`; verify: `npm run refine:verify`.

### Notes

- Sits between Package Builder and Decision Engine. No full rebuild; RahhalBrain unchanged.

## [Unreleased] — Sprint 90: Live Provider Integration Readiness

### Added

- Core provider readiness (`src/core/providers`) — registry, health, circuit breaker, retry, priority/failover, secrets validator, sandbox helpers, metrics, mock/sandbox/live stubs.
- Docs: `LIVE_PROVIDER_READINESS.md`, `PROVIDER_ARCHITECTURE.md`, `PROVIDER_CHECKLIST.md`.
- Verify: `npm run providers-readiness:verify`.

### Notes

- Infrastructure only — no AI engine, conversation, planner, learning, package, or decision changes.
- Coexists with Sprint 71 Provider Runtime; does not cut over live search consumers.

## [Unreleased] — Sprint 89: Alpha Blockers Resolution

### Fixed

- Intent extraction: stop destination corruption from budget/date fillers; destination replace on change cues; budget fillers (`only`/`just`).
- Constitution wired into live `planTurn` (`src/lib/agent/constitution`) with recommendation + recovery facts.
- Package Builder bridge: never silent-skip — flight-first / hotel-first / explanation fallbacks.
- Recommendation display: reason, trade-offs, confidence, alternatives, next action.

### Docs

- `docs/ALPHA_READINESS_REPORT.md` (PASS)
- `docs/SPRINT89_REGRESSION_REPORT.md`
- `docs/SPRINT89_BUG_FIX_REPORT.md`
- `docs/SPRINT89_ARCHITECTURE_IMPACT.md`

### Notes

- No new AI engines; no architecture redesign — Alpha blockers only.

## [Unreleased] — Sprint 88: Alpha Readiness Validation

### Added

- Alpha acceptance docs: `docs/USER_JOURNEYS.md`, `TEST_SCENARIOS.md`, `WEAKNESSES.md`, `TOP20_ALPHA_IMPROVEMENTS.md` (historical WARNING baseline; superseded by Sprint 89 PASS report).

### Notes

- Validation only — no new AI engines, no architecture redesign, no planning/decision engine changes.
- Sprint 88 verdict was **WARNING**; Sprint 89 closed the blockers to **PASS**.

## [Unreleased] — Sprint 87: Rahhal AI Constitution

### Added

- Governing principles doc: `docs/RAHHAL_AI_CONSTITUTION.md`.
- Core governance (`src/core/constitution`) — principles, policy modules, `PrincipleValidator`, behavior snapshots, events.
- Feature flag `ai.constitution` (default ON); verify: `npm run constitution:verify`.

### Notes

- Not a new travel engine. Additive governance only — no engine public API changes, no RahhalBrain redesign.

## [Unreleased] — Sprint 83: AI Dynamic Travel Packages

### Added

- Core package stack (`src/core/packageBuilder`) — build, compatibility, score, optimize, rank, confidence, explainability.
- Agent bridge `src/lib/agent/packageBuilder` + flag `ai.dynamic_packages` (default ON).
- Decision Engine consumes package preference via prioritized offer pools (no public contract change).
- Docs: `docs/SPRINT83_DYNAMIC_PACKAGES.md`; verify: `npm run package:verify`.

### Notes

- Additive only — RahhalBrain unchanged; Adaptive Learning may re-rank; Price Intelligence enriches scores without duplicated pricing logic.

## [Unreleased] — Sprint 81: AI Price Intelligence & Booking Timing

### Added

- Core booking-timing stack (`src/core/priceIntelligence`) — PriceAnalyzer, BookingTimingEngine, trends, confidence, opportunities, explainable timing actions.
- Agent bridge `src/lib/agent/priceIntelligence` + flag `ai.price_intelligence` (default ON).
- Docs: `docs/SPRINT81_PRICE_INTELLIGENCE.md`; verify: `npm run price:verify`.

### Notes

- Not a live pricing feed. Additive after Decision Engine / Adaptive Learning; RahhalBrain unchanged.

## [Unreleased] — Sprint 80: Adaptive Learning & Personalization Engine

### Added

- Core profile + learning stack (`src/core/profile`, `src/core/learning`) — online preference adaptation, confidence ladder, local PreferenceStore, Decision Engine ranking adjustments, explainability.
- Agent bridge `src/lib/agent/adaptiveLearning` + flag `ai.adaptive_learning` (default ON).
- Docs: `docs/SPRINT80_ADAPTIVE_LEARNING.md`; verify: `npm run learning:verify`.

### Notes

- Not ML training. Local-only learning with reset/disable. Additive to Decision Engine; RahhalBrain unchanged.

## [Unreleased] — Sprint 79: Autonomous Search & Decision Engine

### Added

- Core decision stack (`src/core/searchPlanner`, `searchScoring`, `searchRanking`, `decisionEngine`) — multi-plan generation, parallel execution, scoring, ranking, explainable recommendations.
- Agent bridge `src/lib/agent/autonomousDecision` + flag `ai.autonomous_decision` (default ON).
- Docs: `docs/SPRINT79_AUTONOMOUS_DECISION.md`; verify: `npm run decision:verify`.

### Notes

- Additive only — does not redesign RahhalBrain or replace Flight/Hotel engines.

## [Unreleased] — Sprint 78: AI Travel Strategy Planner

### Added

- Travel Strategy Planner (`src/lib/agent/travelPlanner`) — pre-search purpose/constraints/questions/search-plan/priority weights.
- Feature flag `ai.travel_planner` (default ON); additive tool reorder/skip via `selectToolsForTurn`.
- Docs: `docs/SPRINT78_TRAVEL_PLANNER.md`; verify: `npm run planner:verify`.

### Notes

- Runs before Flight/Hotel search; does not redesign RahhalBrain or replace engines.

## [Unreleased] — Sprint 77: Complete Trip Optimizer

### Added

- Trip Optimizer (`src/lib/agent/tripOptimizer`) — Journey Score across flight+hotel packages, dimension scores, recommendation labels, tradeoff diagnostics.
- Feature flag `ai.trip_optimizer` (default ON).
- Docs: `docs/SPRINT77_TRIP_OPTIMIZER.md`; verify: `npm run optimizer:verify`.

### Notes

- Additive enrichment only — does not redesign RahhalBrain or replace search / budget / personalization engines.

## [Unreleased] — Sprint 76: Traveler Personalization Intelligence

### Added

- Traveler Personalization Intelligence (`src/lib/agent/travelerPersonalization`) — preference parse, gradual confidence learning, mock profile store, preference-weighted ranking, diagnostics.
- Feature flag `ai.traveler_personalization` (default ON).
- Docs: `docs/SPRINT76_TRAVELER_PERSONALIZATION.md`; verify: `npm run personalization:verify`.

### Notes

- Additive enrichment only — does not redesign RahhalBrain or replace search engines; no DB integration yet.

## [Unreleased] — Sprint 75: Budget Intelligence

### Added

- Budget Intelligence module (`src/lib/agent/budgetIntelligence`) — parse, allocate, Budget Score ranking, diagnostics.
- Feature flag `ai.budget_intelligence` (default ON).
- Docs: `docs/SPRINT75_BUDGET_INTELLIGENCE.md`; verify: `npm run budget:verify`.

### Notes

- Additive enrichment only — does not replace Flight/Hotel Search Engines or RahhalBrain.

## [Unreleased] — Sprint 74: Conversation → Real Search Integration

### Changed

- Traveler conversation `flights` / `hotels` tools now call Flight Search Engine (Sprint 72) and Hotel Search Engine (Sprint 73) via Provider Runtime (Sprint 71).
- Bridge: `src/lib/agent/tools/searchEngineBridge.ts` (city→IATA, trip-type shaping, best/cheapest/fastest highlights).
- Docs: `docs/SPRINT74_CONVERSATION_INTEGRATION.md`; verify: `npm run conversation:verify`.

### Notes

- Integration only — no new engines; no RahhalBrain / Provider Runtime redesign.

## [Unreleased] — Sprint 73: Hotel Search Engine

### Added
- Hotel Search Engine (`src/lib/agent/hotelSearchEngine`) on Provider Runtime.
- Docs: `docs/SPRINT73_HOTEL_SEARCH_ENGINE.md`; verify: `npm run hotels:verify`.

## [Unreleased] — Sprint 72: Flight Search Engine

### Added
- Flight Search Engine (`src/lib/agent/flightSearchEngine`) on Provider Runtime.
- Docs: `docs/SPRINT72_FLIGHT_SEARCH_ENGINE.md`; verify: `npm run flights:verify`.

## [Unreleased] — Sprint 71: Provider Runtime

### Added
- Provider Runtime (`src/lib/agent/providerRuntime`).
- Docs: `docs/SPRINT71_PROVIDER_RUNTIME.md`; verify: `npm run runtime:verify`.

## [Unreleased] — Sprints 65–70: Production ops + GA

### Added
- Ops stack under `src/lib/ops/*` and GA release manager. See `docs/CHANGELOG_V1.md`.

## [Unreleased] — Sprint 53: Real World Intelligence Layer

### Added

- Live intelligence package (`src/lib/brain/intelligence`) orchestrated through RahhalBrain.
- Provider abstraction (`search` / `availability` / `pricing` / `booking` / `cancel` / `status`) with nine mock domain providers.
- Event bus, multi-layer cache, retry/timeout/circuit breaker, telemetry dashboard.
- Feature flag `ai.real_world_intelligence` (default ON).
- Meta: `AgentProviderMeta.liveIntelligence`.
- Docs: `docs/SPRINT53_REAL_WORLD_INTELLIGENCE.md`; tests: `realWorldIntelligence.sprint53.test.ts`.

## [Unreleased] — Sprint 52: Executive Operating System v1

### Added

- Executive OS layer under RahhalBrain (`src/lib/brain/executive/os` + `engines/os`).
- Ten OS engines: global knowledge, decision optimizer, multi-objective (Pareto), travel graph, prediction, smart negotiation, goal planning, executive strategy, explanation v2, self-review.
- Strategy-gated lazy engine selection + computation cache.
- Feature flag `ai.executive_os` (default ON; depends on `ai.executive_platform`).
- Meta: `AgentProviderMeta.executiveOs`; platform snapshot `ExecutivePlatformResult.os`.
- Docs: `docs/SPRINT52_EXECUTIVE_OS.md`; tests: `executiveOs.sprint52.test.ts`.

## [Unreleased] — Sprint 51: Executive Travel Platform v1

### Added

- Production executive OS under RahhalBrain (`src/lib/brain/executive/platform` + `engines`).
- Ten engines with analyze/plan/execute/confidence/metadata contract.
- Live concierge, trip monitor, explainable decisions, multimodal document extraction, budget v2, risk, optimizer, learning, executive response.
- Feature flag `ai.executive_platform` (default ON).
- Docs: `docs/SPRINT51_EXECUTIVE_PLATFORM.md`; tests: `executivePlatform.sprint51.test.ts`.

## [Unreleased] — Phase 2: AI Travel Executive

### Added

- Executive intelligence layer (`src/lib/brain/executive`) orchestrated through RahhalBrain.
- Rejected-destination memory (`rejectedDestinations` on preference profile).
- Budget warnings and discovery optimizer (scenery / activities / cost).
- Consultant one-liner discovery replies with optimization follow-up.
- Feature flag `ai.travel_executive` (default ON).
- Docs: `docs/PHASE2_TRAVEL_EXECUTIVE.md`; tests: `travelExecutive.phase2.test.ts`.

## [Unreleased] — Sprint 50: Rahhal Brain Core v1

### Added

- `RahhalBrain` orchestration layer (`src/lib/brain/core`) — conversation understanding, multi-intent detection, internal planning, reflection, response composition.
- Production wiring in `travelAgentService.planTurn` when `ai.rahhal_brain` is on (default ON).
- Meta snapshot `AgentProviderMeta.rahhalBrain` for observability.
- Docs: `docs/SPRINT50_RAHHAL_BRAIN_CORE.md`; tests: `rahhalBrain.sprint50.test.ts`.

## [Unreleased] — Sprint 49: Visa & Travel Advisory Intelligence

### Added

- Consultant-grade visa briefings (processing time, documents, Schengen/UK/Canada/Japan hints) on every reasoning candidate.
- Travel advisory notes (season, cost, long-haul, safety priors) from catalog risks.
- Warmer `formatReasoningReply` consultant voice with structured visa/advisory lines.
- Docs: `docs/SPRINT49_VISA_ADVISORY.md`; tests: `visaIntelligence.sprint49.test.ts`.

## [Unreleased] — Sprint 48: Persistent Preference Memory

### Added

- Durable personalization profiles via `PreferenceStorage` (localStorage) behind `ai.persistent_memory` (default ON).
- `favoriteDestinations` on travel-style profiles; learned when a destination is locked.
- Cross-session seed of budget / weather / travelers so the agent does not re-ask known preferences.
- Docs: `docs/SPRINT48_PERSISTENT_MEMORY.md`; tests: `persistentMemory.sprint48.test.ts`.

## [Unreleased] — Sprint 47: Cold Destination Discovery Expansion

### Added

- Reasoning catalog expansions: Switzerland, Austria, Norway, Canada, New Zealand, Sapporo, Iceland with seasonal climate priors.
- Country/city aliases for extraction + profile lookup (Japan→Tokyo, Queenstown→NZ, …).
- Docs: `docs/SPRINT47_COLD_DESTINATION_DISCOVERY.md`; tests: `coldDestinationDiscovery.sprint47.test.ts`.

## [Unreleased] — Sprint 46: Smart Clarification / Never-Ask-Twice

### Added

- Soft preference inference on the production agent path (`ai.smart_clarification`, default ON).
- Hard-only clarification gates: destination / duration / budget / travelers; interests, weather, hotel, package, budget style, and traveler type are inferred.
- Docs: `docs/SPRINT46_SMART_CLARIFICATION.md`; tests: `smartClarification.sprint46.test.ts`.

## [Unreleased] — Sprint 45: Autonomous Travel Reasoning Engine

### Added

- Open-ended destination discovery on the production `/chat` agent path (`ai.travel_reasoning`, default ON).
- Deterministic climate × budget × visa reasoning catalog with explainable recommendations (AR/EN).
- Preference memory bridge: seed empty intake slots from `PreferenceEngine` and learn stated preferences back (never overwrite).
- `destinationFlexible` intake + Concierge policy so the agent proposes destinations instead of asking “where?”.
- Docs: `docs/SPRINT45_TRAVEL_REASONING.md`; tests: `travelReasoning.sprint45.test.ts`.

## [1.1.0-rc.1] — 2026-07-20

### Stabilization (no new product features)

- Repository cleanup: removed agent batch push artifacts, unused components/pages, duplicate scoring/report utils, unused `@vitest/ui`.
- Quality: typecheck / lint (0 warnings) / 1600 Vitest tests / production build all green.
- Performance: route-level `React.lazy` code-splitting + vendor chunks (entry JS ~24 kB vs prior ~2 MB monolith).
- Security: coupons RLS SELECT-only for authenticated; Moyasar webhook header-only secrets; chat media URL allowlist; RapidAPI `VITE_*` warnings on hardened targets; session persist timer cleanup.
- Docs: `RELEASE_NOTES_v1.md`, `PRODUCTION_CHECKLIST.md`, `RC_STABILIZATION_REPORT.md`; README / AI architecture / feature registry refreshed.

### Included from main (already merged)

- Sprint 42 Conversation Experience & Booking UX (`ui.conversation_experience`, default OFF).
- Sprint 43 Rahhal AI Orchestrator (`brain.ai_orchestrator`, default OFF).
- Sprint 44 ChatGPT-like conversation experience (`ui.chatgpt_experience`, default OFF).

## [Unreleased] — Production MVP: Preview deployment readiness

### Added

- Preview deploy target + `verifyPreviewEnvironment()` / `npm run preview:verify` (mock payment, live providers OFF, Supabase required).
- `.env.preview.example`, `npm run build:preview`, docs `docs/PREVIEW_DEPLOYMENT.md`.
- GitHub workflow **Preview readiness** — env verify, preview build, providers check, Playwright, uploads `preview-dist` artifact (no production deploy).

## [Unreleased] — Production MVP: Browser E2E (Playwright)

### Added

- Playwright Chromium funnel spec: login (demo) → search → results → booking review → checkout → payment preparation.
- `npm run build:e2e` / `npm run test:playwright` (demo auth + mock providers; production behavior unchanged).
- CI job **Browser E2E (Playwright)** after quality gates; uploads report on failure.
- Stable `data-testid` hooks on funnel CTAs (no product behavior change).

## [Unreleased] — Production MVP: My Trips lifecycle

### Added

- My Trips durable **cancel** (`إلغاء الحجز`) via `cancelBookingSession` + `syncBookingSession`.
- Resume/cancel eligibility helpers (`myTripsActions.ts`) with unit coverage.

## [Unreleased] — Production MVP: Amadeus Sandbox

### Added

- Amadeus sandbox funnel wiring: `bookingUrl` on flight offers, `amadeusSandbox` readiness helpers, default sandbox host for Amadeus flight adapter.
- `liveSearchOrchestrator` passes Amadeus `bookingUrl` / offer id into results metadata for BookingReview.
- Docs: `docs/AMADEUS_SANDBOX.md` staging pilot checklist (opt-in; mock remains default).

## [Unreleased] — Production MVP: unified booking funnel

### Added

- Results → BookingReview selection hop (`bookingSelectionMapper`, select CTAs on results cards).
- TravelConversation / SearchWorkspace open full results with `travelSessionId`.
- BookingReview exit: provider redirect **or** Rahhal checkout via `prepareBookingPayment`.

## [Unreleased] — Production MVP: booking persistence (production-ready)

### Added

- Durable booking session persistence (`bookingPersistence.ts`): Supabase write-through + per-user local cache fallback.
- `BookingOrchestrator.importSession` / `replaceUserSessions` for hydrate-after-reload.
- My Trips loads real persisted booking records for the signed-in user.
- Booking review/return resume persisted sessions and sync status changes.

### Security / hardening

- Local cache keyed per `userId` (no cross-user leakage on shared browsers).
- `loadBookingSession(sessionId, userId)` enforces ownership before hydrate.
- BookingReview / BookingReturn wait for auth and never persist as `'anonymous'`.
- Sync upserts: update then create-if-missing (offline-first create path).

## [Unreleased] — Phase AB

### Added

- v1.1 AI enhancement foundation (`src/lib/ai/**`): FeatureRegistry, PreferenceEngine, RankingEngine, RecommendationEngine, planning helpers, anonymous ProductAnalytics.
- Docs: `V1_1_ROADMAP.md`, `FEATURE_REGISTRY.md`, `AI_ARCHITECTURE.md`.
- Suite: `npm run test:ai` (`ai.phaseAB.test.ts`).
- No UI redesign; payments and live providers remain mock/OFF.

## [Unreleased] — Phase AA

### Added

- Post-launch monitoring snapshot (`collectMonitoringSnapshot`) and signal recorders.
- Provider-neutral alerting (`evaluateAlertRules`, `MockAlertDispatcher`).
- Incident lifecycle manager + feedback repository (PII-masked support views).
- Patch-release / rollback decision helpers (`evaluatePatchRelease`).
- Post-release verification suite: `npm run test:post-release`.
- Ops runbooks: monitoring, alerting matrix, hotfix, incident template, customer support, post-release checklist.

## [1.0.1] — 2026-07-16

### Fixed

- Restored the missing `npm run providers:check` quality gate (merged via PR #56).
- Added explicit **Providers check** step to GitHub Actions CI (after unit tests, before build).
- Implemented config-only provider readiness validation using existing Phase W/X APIs:
  - requires `VITE_PAYMENT_PROVIDER=mock`
  - requires live providers master switch OFF by default
  - requires mock fallback ON by default
  - performs no network probes in the default path
- Added failure-path coverage for non-mock payment and forbidden client-side secret env keys.

### Notes

- Patch/tooling release only — no application features, no UI changes, no API/DB contract changes.
- Does **not** enable live travel providers.
- Does **not** change payment behavior (mock remains the only enabled mode).
- Package version set to `1.0.1`.

## [1.0.0] — 2026-07-15

### Released

- First stable production release of Rahhal AI Platform.
- Promoted from validated `v1.0.0-rc1` after RC1 exit criteria passed.

### Includes (from RC1 validation freeze)

- End-to-end core journey coverage (auth, chat/voice, trip intake, TripPlan, aggregation, decision scoring, My Trips, mock booking/payment/ticketing/notifications, cancel, timeline/audit).
- Failure-path and resilience suites (timeouts, rate limits, circuit breaker, mock fallback, partial failures, retries, DLQ, unauthorized access, expired session, voice denied/interrupt/reconnect).
- Staging smoke suite (health/readiness, mock payment, live-provider defaults OFF, env validation, secret hygiene, security headers, PII masking, rate limits).
- Release operations artifacts: test report, known issues, blockers checklist, staging smoke checklist, rollback plan.
- Production-hardening ops controls from Phase X (still active in v1.0.0).

### Security posture

- `VITE_PAYMENT_PROVIDER=mock` remains the only enabled payment mode.
- Live travel providers remain disabled by default.
- Client bundles must not carry provider secrets; secret hygiene scan is part of CI.

### Changed

- Package version set to `1.0.0`.

## [1.0.0-rc1] — 2026-07-15

### Added

- RC1 end-to-end core journey coverage (`rc1.coreJourney.test.ts`).
- RC1 failure-path suite (`rc1.failurePaths.test.ts`).
- RC1 staging smoke suite (`rc1.stagingSmoke.test.ts`).
- Release artifacts for RC1 validation.
- npm scripts: `test:e2e`, `test:smoke`, `test:rc1`.

### Notes

- Release candidate for staging validation; subsequently promoted to `v1.0.0`.
