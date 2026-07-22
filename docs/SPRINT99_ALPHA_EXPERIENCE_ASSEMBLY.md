# Sprint 99 — Alpha Experience Assembly

**Type:** Additive presentation / orchestration (`src/core/alphaExperience` assembly + agent bridge)  
**Depends on:** Sprint 91 Alpha Experience · Sprint 96/97 Concierge outputs · existing package / flight / hotel / price / decision snapshots  
**Feature flag:** `ai.alpha_experience` (default **ON**) — same flag as Sprint 91; OFF preserves legacy exactly

## Goal

Assemble **all existing AI outputs** into one unified traveler experience DTO for Future UI — without new intelligence, search, or decision making.

## Architecture

```
Existing Engines (Decision · Packages · Price · Flights · Hotels · Concierge)
        ↓
Conversation Result / Concierge Integration snapshots
        ↓
AlphaExperienceComposer (Sprint 99)
        ├─ TravelerJourney (timeline)
        ├─ TravelerRecommendation (final recommendation)
        ├─ TravelerSummary
        ├─ ExperienceSections (omit missing · no placeholders)
        ├─ ExperiencePriority (critical → low)
        └─ TravelerResponseBuilder (dedupe)
        ↓
Unified Traveler Experience DTO (AlphaExperienceDTO)
        ↓
Agent bridge → meta.alphaTravelerExperience
        ↓
Future UI
```

**Does not modify:** RahhalBrain, ConversationBrain, SearchPlanner, DecisionEngine, AdaptiveLearning, Price Intelligence, Package engines, Booking engines, Provider integrations, existing business logic / search / recommendation algorithms.

## Sections (omit when data missing)

| Section | Priority | Source |
|---------|----------|--------|
| Final Recommendation | Critical (DTO field) | Concierge summary / decision / package |
| Confidence | Critical | Concierge confidence / engine confidence |
| Price Opportunity | Critical | Price Intelligence note |
| Flight | High | Tool offers / package flight component |
| Hotel | High | Tool offers / package hotel component |
| Package | High | Dynamic Packages selected |
| Alternatives | High | Concierge alternatives |
| Concierge | High | Concierge explanation + option |
| Explanation | Medium | Concierge why-* facets |
| Conversation Summary | Medium | Concierge summary |
| Timeline | Medium | Concierge timeline or derived journey |
| Suggested Next Action | Low | Concierge next step |

## Deduplication

- Identical explanation / summary / concierge / price text fingerprints are merged.
- Higher-priority section wins when texts collide.
- Key reasons and recommendation candidates are string-deduped.

## Feature flag

`ai.alpha_experience` — default **ON**.

- **ON:** `planTurn` attaches `alphaTravelerExperience` (compact meta + full `experience` DTO).
- **OFF:** assembly returns `null`; current application behavior unchanged.

## Added / extended modules

| Module | Path | Role |
|--------|------|------|
| AlphaExperienceDTO | `src/core/alphaExperience/AlphaExperienceDTO.ts` | Unified DTO + compose input |
| ExperiencePriority | `…/ExperiencePriority.ts` | Critical → low ranking |
| ExperienceSections | `…/ExperienceSections.ts` | Build / omit sections |
| TravelerJourney | `…/TravelerJourney.ts` | Timeline assembly |
| TravelerRecommendation | `…/TravelerRecommendation.ts` | Final recommendation text |
| TravelerSummary | `…/TravelerSummary.ts` | Summary + key reasons |
| TravelerResponseBuilder | `…/TravelerResponseBuilder.ts` | DTO + section dedupe |
| AlphaExperienceComposer | `…/AlphaExperienceComposer.ts` | Public composer API |
| Agent assembly | `src/lib/agent/alphaExperience/assembly.ts` | Flag-gated turn bridge |

Sprint 91 ConversationOrchestrator remains untouched and coexists.

## Tests

Files:

- `src/lib/__tests__/alphaExperience.sprint91.test.ts` (unchanged)
- `src/lib/__tests__/alphaExperience.sprint99.test.ts` (new)

Verify:

```bash
npm run alpha-experience:verify
```

## Compatibility

| Check | Expectation |
|-------|-------------|
| Public engine APIs | Unchanged |
| Providers / booking / search / decision | Unchanged |
| Sprint 91 orchestrator | Untouched |
| Sprint 96/97 Concierge | Consumed read-only |
| Circular imports | None (`npm run arch:circular`) |
| Quality gates | `lint` · `typecheck` · `build` · `test` |

## Ready for Sprint 100

Alpha Experience Assembly produces a stable `AlphaExperienceDTO` for Future UI consumption. Sprint 100 can render sections without touching engines.
