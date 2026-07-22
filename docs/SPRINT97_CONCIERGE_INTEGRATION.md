# Sprint 97 — AI Concierge UI Integration

**Type:** Additive presentation / conversation pipeline integration  
**Depends on:** Sprint 96 Concierge Experience (`ai.concierge_experience`)  
**Does not modify:** RahhalBrain internals, SearchPlanner, DecisionEngine, AdaptiveLearning, Price Intelligence, Dynamic Packages, Unified Trip, Booking Orchestrator business logic

## Goal

Surface Sprint 96 Concierge outputs automatically on AI conversation turns as **UI-ready DTOs**, while preserving legacy responses when the feature flag is off.

## Architecture impact

```
Existing engines (unchanged)
        ↓  read-only snapshots
offersFromEngineSnapshots / tripFactsFromMemory
        ↓
integrateConciergeIntoTurn  →  ConciergeComposer (Sprint 96)
        ↓
RecommendationResponseDto (+ ConversationResponseDto / TripResponseDto)
        ↓
travelAgentService.planTurn
  • appends recommendationFacts → Conversation Brain facts
  • attaches meta.conciergeExperience + meta.conciergeRecommendation
```

- **Zero** engine redesign  
- **Zero** circular imports (agent → core concierge only)  
- Flag off → empty DTO + no meta + no facts (legacy path)

## Added modules

| Path | Role |
|------|------|
| `src/lib/agent/conciergeIntegration/types.ts` | UI DTOs |
| `…/serializers.ts` | Result → Recommendation / Conversation / Trip DTOs |
| `…/adapters.ts` | Memory + engine snapshots → Concierge facts |
| `…/pipeline.ts` | `integrateConciergeIntoTurn` |
| `…/index.ts` | Barrel |

## Modified files

| Path | Change |
|------|--------|
| `src/lib/agent/travelAgentService.ts` | Call integration before `buildTravelFacts`; attach meta |
| `src/lib/agent/types.ts` | Optional `conciergeRecommendation` on `AgentProviderMeta` |
| `src/lib/agent/index.ts` | Export integration APIs |
| `package.json` | `concierge-integration:verify` |
| `CHANGELOG.md` | Sprint 97 entry |

## Response contract (additive)

`RecommendationResponseDto` always exposes:

- `timeline`
- `confidence`
- `summary`
- `alternatives`
- `comparisonCards`
- `suggestions`
- `explanation`
- `conciergeEnabled`

When disabled: fields are `null` / `[]` and `conciergeEnabled: false`.

## Feature flag

Uses existing **`ai.concierge_experience`** (Sprint 96). No new flag required.

## Tests

`src/lib/__tests__/conciergeIntegration.sprint97.test.ts`

- legacy / flag off  
- concierge enabled full payload  
- null / empty offers  
- low confidence  
- package / hotel / flight adapters  
- trip + conversation serializers  

```bash
npm run concierge-integration:verify
```

## Compatibility

| Area | Status |
|------|--------|
| Prior response contracts | Compatible (additive meta only) |
| Sprint 96 Concierge core | Unchanged API |
| Engines / Booking / Unified Trip | Untouched |
| Frontend components | None added (DTO-only sprint) |
