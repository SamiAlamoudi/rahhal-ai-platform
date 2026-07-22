# Sprint 112 — AI Memory & Personalization Engine

**Type:** Additive personalization layer (`src/lib/agent/memory/`)  
**Position:** Cross-cutting memory used after conversation turns; Concierge / Response Composer may consume metadata

## Architecture

```
Conversation
        ↓
Search Planner → … → Trip Builder → Decision Engine → Response Composer → AI Concierge
        ↑                                                              ↑
        └──────────── AI Memory & Personalization (Sprint 112) ────────┘
```

Import path: `src/lib/agent/memory/index` (distinct from legacy `src/lib/agent/memory.ts` intake helpers).

## Feature flag

`ai.memory_engine` — **default OFF**

| State | Behavior |
|-------|----------|
| OFF | `runMemoryEngine` returns `{ enabled: false }` — legacy paths unchanged |
| ON | Extract → persist/merge preferences → conversation memory → history → resolve → score → metadata |

## Preference lifecycle

1. **Extract** — pattern-based cues from user utterances (free-form values; no fixed airline catalogs).
2. **Update / merge** — confidence-weighted upsert; prune obsolete low-confidence prefs.
3. **Store** — process-local preference store (DB/Supabase can plug in later).
4. **Resolve** — apply memory prefs; **explicit current-turn requests always win**.
5. **Score** — preference / budget / style / history / destination affinity.
6. **Metadata** — matched / ignored prefs, confidence, source, reasoning summary.

## Memory model

- **Traveler profile** — airlines, hotels, cabin, stars, destinations, budget, styles, airports, layover, seat, meals, amenities, language, currency, timezone.
- **Conversation memory** — destinations, searches, recommended / accepted / rejected itineraries across conversations.
- **Travel history** — favorite city/airline/hotel, average cost/stay, trip count.

## Integration examples

```ts
import { runMemoryEngine, toConciergeMemoryHints } from '../agent/memory/index'

const memory = runMemoryEngine(
  {
    userId: 'u1',
    conversationId: 'c1',
    messages: [{ role: 'user', text: 'I always fly Qatar Airways. My budget is around 12000 SAR.' }],
    explicit: { destination: 'DXB' }, // wins over stored destination prefs
    candidates: [/* Decision Engine / Trip Builder options */],
  },
  { enabled: true },
)

// Concierge may explain using memory hints (Concierge code unchanged)
memory.conciergeHints
// → "I selected this itinerary because it matches your previous travel preferences."
```

## Does not modify

Decision Engine · Provider Gateway · Trip Builder · Response Composer · Live Flight/Hotel Search

## Verify

```bash
npm run memory:verify
```

Runs lint, typecheck, build, and Sprint 112 tests.
