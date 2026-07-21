# Sprint 80 — Adaptive Learning & Personalization Engine

**Type:** Additive online preference adaptation (`src/core/profile` + `src/core/learning` + agent bridge)  
**Depends on:** Autonomous Decision Engine (79)

## Goal

Rahhal continuously improves future recommendations using previous conversations, traveler behavior, booking outcomes, and feedback.

This is **not** machine learning training. It is a local online preference adaptation layer. RahhalBrain architecture is unchanged.

## Architecture (additive)

```
Conversation / Feedback / Bookings
    ↓
AdaptiveLearningEngine
    ├── PreferenceInference
    ├── FeedbackProcessor
    ├── BehaviorAnalyzer
    └── ConfidenceAdjuster
    ↓
TravelerProfile (PreferenceStore — local only)
    ↓
DecisionEngine (+ RecommendationImprover)
    ↓
Explainable “Recommended because…” bullets
```

## Modules

| Path | Role |
| --- | --- |
| `src/core/profile/` | TravelerProfile, PreferenceStore, weights, behavior history, sessions |
| `src/core/learning/` | AdaptiveLearningEngine, inference, feedback, confidence, improver |
| `src/lib/agent/adaptiveLearning/` | Feature flag + turn bridge |

## Preference kinds

Airlines · hotel brands · room type · cabin · seat · airports · transfer tolerance · hotel budget style · luxury vs value · food · activity · travel pace · trip duration · favorite/disliked destinations · booking habits · loyalty · departure/arrival times · family/solo patterns · walkability

## Confidence ladder

`0.10 → 0.25 → 0.40 → 0.60 → 0.80 → 0.95`

- Increases with repeated same-polarity behavior  
- Decreases when opposite behavior appears  

## Privacy

- Learning remains **local** (in-memory PreferenceStore)
- No external AI training / no user data leakage
- Supports **reset profile** and **disable learning**

## Observability

`learning.started` · `learning.completed` · `profile.updated` · `preference.inferred` · `recommendation.adjusted` · `confidence.updated`

## Feature flag

`ai.adaptive_learning` (default **ON**, depends on `ai.autonomous_decision`)

Verify: `npm run learning:verify`

## Performance

- Learning is synchronous and O(preferences + recent behavior) — typically well under 5ms per turn
- Decision Engine adjustment is a single linear pass over candidates before re-rank
- No network I/O; store is process-local mock

## Coverage

Unit tests cover inference, confidence, recommendation adjustment, behavior history, profile updates, privacy reset, learning disabled, repeated behavior, and edge cases (`src/lib/__tests__/adaptiveLearning.sprint80.test.ts`).
