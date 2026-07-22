# Sprint 91 — Production Alpha Experience

**Type:** Additive experience / orchestration layer (`src/core/alphaExperience` + agent bridge)  
**Depends on:** Intent extraction · Constitution (87/89) · Search plans (79) · Provider readiness (90) · Package Builder (83) · Itinerary Refinement (84) · Decision Engine (79)

## Goal

Transform Rahhal into a fully usable Alpha product by connecting **existing** intelligence into one complete conversation flow — without redesigning engines.

## Architecture

```
User Conversation
        ↓
Intent Extraction          (extractFromUserText / memory merge)
        ↓
Constitution Validation    (validatePrinciples / applyConstitutionToTurn)
        ↓
Search Planning            (createSearchPlans)
        ↓
Provider Search            (ProviderRegistry failover — mock/sandbox/live)
        ↓
Dynamic Package Builder    (runPackageBuilder)
        ↓
Itinerary Refinement       (runItineraryRefinement)
        ↓
Decision Engine            (runDecisionEngine on refined offer pools)
        ↓
Explanation Builder        (presentation layer — natural language)
        ↓
Final Recommendation       (AlphaRecommendation + alternatives + confidence)
```

RahhalBrain unchanged. Engine public APIs unchanged. No duplication of scoring / ranking / package / refinement logic.

## Orchestration

`ConversationOrchestrator` (`src/core/alphaExperience/ConversationOrchestrator.ts`):

- Coordinates existing engines only
- Emits a reusable **AI thinking timeline**
- Aggregates confidence, explanations, alternatives
- Converts provider/search failures into recoverable traveler messages
- Produces a presentation-ready `AlphaRecommendation`

Agent bridge: `runAlphaExperienceConversation` / `enrichWithAlphaExperience`  
Feature flag: `ai.alpha_experience` (default **ON**, depends on refinement + constitution + packages)

Verify: `npm run alpha-experience:verify`

## Timeline

Stages include: Analyzing request · Understanding intent · Constitution check · Search planning · Searching flights/hotels · Comparing options · Building package · Optimizing itinerary · Decision · Generating alternatives · Preparing recommendation · Completed

Each stage supports: `status`, timestamps, `durationMs`, cumulative `progressPercent`, recoverable failure messages.

## Recommendation model

`AlphaRecommendation` includes:

- Trip summary · Flights · Hotels · Transportation · Activities
- Estimated cost · Confidence breakdown · Explanation
- Warnings · Recommendations · Alternatives · Recovery messages

## Confidence

Reuses engine confidence signals (provider / package / decision / refinement). Exposes:

- Overall · Flight · Hotel · Package · Decision · Refinement
- Reasoning summary (natural language)

## Alternatives

Scenario labels built from existing package labels + decision bundle picks:

Best Value · Cheapest · Luxury · Family · Business · Fastest · Adventure

Each includes its own explanation.

## Error experience

Technical errors are never shown. Failures map to recoverable copy such as:

- Searching alternative flights...
- Trying another provider...
- Optimizing itinerary...
- Unable to find matching package. Would you like to adjust your budget?

Provider failover from Sprint 90 is reused.

## Observability

Structured events:

`conversation.started` · `intent.extracted` · `constitution.validated` · `search.planned` · `search.completed` · `package.completed` · `refinement.completed` · `decision.completed` · `recommendation.generated` · `conversation.completed` · `recovery.triggered`

Duration metrics attached where available.

## Future UI integration

- Bind `AlphaProgressTimeline` to a thinking/progress rail in `/chat`
- Render `AlphaRecommendation` as the primary trip card
- Surface `alternatives[]` as selectable scenario chips
- Show `recoveryMessages` inline without error codes
- Optional: attach `providerMeta.alphaExperience` from the agent bridge meta helper

## Testing

`src/lib/__tests__/alphaExperience.sprint91.test.ts` covers:

- Complete conversation flow
- Recommendation generation
- Timeline events
- Confidence aggregation
- Alternative generation
- Error recovery / provider fallback
- Explanation generation
- Feature flag gating

## Notes

- Additive only — does not modify Constitution, Learning, Decision Engine, Dynamic Packages, Provider Readiness, Alpha Blockers, or Itinerary Refinement modules
- Backward compatible — existing `travelAgentService` path unchanged; Alpha Experience is an optional orchestrated entry point
