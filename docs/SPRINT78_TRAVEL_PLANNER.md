# Sprint 78 — AI Travel Strategy Planner

**Type:** Additive pre-search reasoning layer  
**Depends on:** Conversation Flow · Flight/Hotel Search Engines · Budget · Personalization · Trip Optimizer · Booking Intelligence

## Goal

Before searching flights or hotels, Rahhal builds an internal **Travel Strategy**: why the traveler is going, constraints, missing information, search order, and priority weights.

## Architecture (additive)

```
Conversation
    ↓
Travel Planner (Sprint 78)  ← NEW (before engines)
    ├── purpose · trip type · traveler type
    ├── constraints · preferences · risk flags
    ├── missing info · combined clarifying question
    └── search plan · priority weights · confidence
    ↓
Flight / Hotel Search Engines
    ↓
Budget Intelligence → Traveler Personalization → Trip Optimizer → Booking Intelligence
```

No RahhalBrain redesign. No engine replacement. Existing intake / tool gating preserved; planner **reorders / skips** tools additively.

## Planner output

`travelPurpose` · `tripType` · `travelerType` · `constraints` · `preferences` · `missingInformation` · `requiredQuestions` · `recommendedSearchOrder` · `priorityWeights` · `riskFlags` · `travelStrategy` · `confidenceScore`

## Question optimizer

Ask only when required. Combine missing slots into **one** concise question:

> “What dates will you travel, and how many people are joining you?”

## Module

`src/lib/agent/travelPlanner/`

Feature flag: `ai.travel_planner` (default **ON**)

Verify: `npm run planner:verify`

## Example conversations

### Conference + visa already held

> User: I have a conference in Tokyo. My budget is SAR 9000. I already have a visa. I want direct flights. I only stay at Marriott.  
> Planner: purpose=conference · hotel-first · skip visa · direct-flight + brand constraints · flights/hotels ordered accordingly.

### Incomplete request

> User: I want to travel somewhere nice.  
> Planner: shouldAskQuestion · combined question for destination, dates, and travelers · no unnecessary single-slot spam.

### Family

> User: We have two children. Family trip to Paris for a week.  
> Planner: purpose=family · children constraint · family priority weight ↑.

## Diagnostics

`travelStrategy` · `constraints` · `priorityWeights` · `plannerReasoning` · `confidenceScore` · `questionsAsked` · `searchPlan`

## Known limitations

- Planner does not replace intake `missingFields` gating (additive only).
- Destination aliases still rely on existing `extractRequirements`.
- Multi-city planning flags strategy; full multi-city engine routing remains future work.

## Next recommendations

1. Persist Travel Strategy onto trip records.
2. Feed priority weights into Trip Optimizer intent blending.
3. Surface combinedQuestion via Conversation Brain when collecting.
