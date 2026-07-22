# Sprint 111 — AI Concierge Experience (Decision Conversation Layer)

**Type:** Additive conversation layer (`src/lib/agent/concierge`)  
**Position:** Response Composer → **Concierge (Sprint 111)** → UI / conversation

## Architecture

```
Conversation
        ↓
SearchPlanner
        ↓
Provider Gateway
        ↓
Live Flight Search
        ↓
Live Hotel Search
        ↓
Trip Builder
        ↓
Decision Engine
        ↓
Response Composer
        ↓
AI Concierge (Decision Conversation)   ← Sprint 111
```

Sprint 111 transforms structured recommendations into a premium decision conversation: why this itinerary, tradeoffs, what-if scenarios, savings, narration, and metadata.

## Feature flag

`ai.concierge_experience` — shared with Sprint 96 presentation layer (registry default **ON**).

| State | Sprint 111 behavior |
|-------|---------------------|
| OFF | `runConcierge` returns `{ enabled: false }` — no enhancement |
| ON | Explainer → tradeoffs → scenarios → savings → narrator → metadata |

Sprint 111 does **not** change the registry default. It is an additive consumer; existing Sprint 96 / Alpha paths are untouched and remain inert until `runConcierge` is called.

## Flow

1. Caller supplies Decision Engine / Response Composer recommendation facts (and optional `responseComposer` result).
2. `ConversationExplainer` builds why-selected, strengths, weaknesses, best-for (facts only).
3. `TradeoffAnalyzer` compares the selected option to alternatives (structured tradeoffs).
4. `ScenarioSimulator` answers what-if prompts using **existing** options only — never re-searches.
5. `SavingsAnalyzer` reports price deltas / budget headroom from known prices only.
6. `RecommendationNarrator` produces concise natural-language lines.
7. `ConversationMetadata` assembles confidence, warnings, highlights, cost/quality summaries.
8. `responseComposerAttachment` lets Response Composer consumers merge narration without changing RC.

## Integration

```ts
import { runConcierge, optionsFromResponseComposer } from '../agent/concierge'
import { runResponseComposer } from '../agent/responseComposer'

const composed = runResponseComposer(input, { enabled: true })
const concierge = runConcierge(
  {
    conversationId: 'conv',
    responseComposer: composed,
    recommendations: optionsFromResponseComposer(composed),
    decisionConfidence: 0.88,
    budget: 5000,
  },
  { enabled: true }, // explicit when testing; registry also gates
)
```

## Modules

| Module | Role |
|--------|------|
| ConciergeRunner | Flag gate + orchestration |
| ConversationExplainer | Why selected / strengths / weaknesses / best for |
| TradeoffAnalyzer | Structured comparisons |
| ScenarioSimulator | What-if (no re-search) |
| SavingsAnalyzer | Savings & value notes from facts |
| RecommendationNarrator | Concise NL narration |
| ConversationMetadata | Structured metadata + RC option mapping |

## Examples

- “I selected this option because it offers the best balance between price, travel duration, and hotel quality.”
- “The second option is cheaper but includes a longer journey.”
- “The premium option costs more but significantly improves comfort.”

## Does not modify

Decision Engine · Provider Gateway · Trip Builder · Response Composer · Live Flight/Hotel Search · Sprint 96 core composer

## Verify

```bash
npm run concierge:verify
```

Runs lint, typecheck, build, and Sprint 111 tests.
