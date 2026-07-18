# v1.1.0 Roadmap — Rahhal AI Platform

**Status:** Phase AB complete on branch (interfaces + tests); next slice AB.1 / Phase AC  
**Base:** stable `v1.0.1` + Phase AA ops  
**Payment posture:** `VITE_PAYMENT_PROVIDER=mock` (live payments remain feature-flagged OFF)  
**Providers:** live travel providers remain OFF by default (Phase W master flag)

## Goals

Deliver AI planning quality and personalization foundations without breaking v1.0 contracts, redesigning UI, or enabling live payments.

## Themes

| Theme | v1.1 intent | Phase AB deliverable |
|-------|-------------|----------------------|
| Feature governance | Lifecycle-managed flags | `FeatureRegistry` (`experimental` → `deprecated`) |
| AI planning | Multi-city + alternatives + confidence | `src/lib/ai/planning` helpers |
| Personalization | Preference profiles + weighting | `PreferenceEngine` + profile types |
| Recommendations | Explainable ranking | `RecommendationEngine` / `RankingEngine` interfaces |
| Analytics | Anonymous funnel metrics | privacy-gated `ProductAnalytics` |
| Docs | Shared planning truth | this file + `FEATURE_REGISTRY.md` + `AI_ARCHITECTURE.md` |

## Suggested delivery slices (post-approval)

1. **AB (this phase):** interfaces, helpers, docs, tests — no UI.
2. **AB.1:** wire preference weighting into decision scoring (additive fields only).
3. **AB.2:** persist personalization profiles server-side (RLS) when privacy flags allow.
4. **AB.3:** optional UI surfaces for alternatives/explanations (separate approved phase).
5. **Payments:** remain mock until an explicit production-payment phase.

## Non-goals for v1.1.0 planning

- UI redesign
- Breaking TripPlan / booking / payment / ProviderAdapter APIs
- Default-on live payments or live providers
- Project rename

## Exit criteria for Phase AB

- [x] FeatureRegistry with four lifecycles
- [x] AI planning foundation helpers
- [x] Personalization profile model
- [x] Recommendation / Preference / Ranking engine interfaces
- [x] Anonymous analytics foundation
- [x] Docs + unit tests green
