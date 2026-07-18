# AI Concierge — Conversation Intelligence (Sprint 9)

## Role

The Concierge is a **senior travel consultant** sitting **above** the travel agent / search engine.

The conversation is the only customer interface. Concierge decides whether to greet, ask, advise, propose options, confirm, or hand off to the agent.

## Provider-agnostic rule (hard)

Concierge **must never** know or select suppliers (Duffel, Travelport, Sabre, Amadeus, Booking, Expedia, or any future provider).

It may only communicate with **agent abstractions** (`TripRequirements`, `AgentMemory`, `AgentIntent`, `TripPlan`, `travelAgentService.planTurn` handoff flags).

Provider selection, orchestration, ranking, retries, and fallbacks remain exclusively in the provider / aggregation layer.

## Package map

```
src/lib/concierge/
  types.ts               Dialogue phases, actions, soft signals
  dialogueState.ts       Phase machine
  softSignals.ts         Free-text soft preference extraction
  turnPolicy.ts          Ask / advise / confirm / execute decisions
  consultantVoice.ts     ar/en consultant replies
  recommendationBridge.ts  Phase AB RecommendationEngine framing (no catalogs)
  searchHandoff.ts       Agent handoff modes only (plan|search|refine|none)
  conciergeService.ts    Turn orchestration
  meta.ts                Persist state on AgentProviderMeta.concierge
```

## Feature flag

`ai.concierge` in `FeatureRegistry` (experimental, default on).

Disable via flag or `createTravelAgentService({ concierge: false })`.

## Turn flow

```
User message
  → extract + AgentMemory (existing)
  → Concierge.runTurn (if ai.concierge)
      → consultant reply  OR  shouldExecuteAgent
  → travelAgentService existing plan/tools path (unchanged providers)
```
