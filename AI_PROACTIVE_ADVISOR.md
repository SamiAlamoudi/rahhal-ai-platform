# AI Proactive Travel Advisor — Phase 3 Stage 3

**Status:** Additive recommendation layer · Flag `ai.proactive_advisor` **default OFF**  
**Freeze:** Production planning · trip generation · pricing · itinerary · recommendation / strategy engines · Runtime Coordinator · Consultant Pipeline · Unified Response · Conversation Orchestrator / Multi-Turn Manager internals.

The Proactive Travel Advisor recognizes opportunities to help the traveler. It emits **recommendations only** and attaches them under `meta.proactiveAdvisor`.

---

## 1. Behavior

| Cue | Example tip |
|-----|-------------|
| Destination | Visa / currency / eSIM / timezone / insurance reminders |
| Dates | Weather / season / packing / check-in / alternative timing |
| Budget | Saving opportunities (no destination change) |
| Family | Family-friendly hotels / transportation |
| Business | Lounge / protocol / transfer / meeting logistics |
| Accessibility | Verify hotels, transfers, airports |

These never modify trip planning.

---

## 2. Input (read-only)

Conversation context · memory context · traveler understanding · destination understanding · strategy summary · unified response · multi-turn snapshot (when present).

---

## 3. Output

**Only** `meta.proactiveAdvisor`.

Never modifies: `tripPlan` · `planningGraph` · `recommendations` · `strategy` · `runtimeCoordinator` · `consultantPipeline` · conversation reply / multi-turn session.

Each recommendation includes: `reason` · `confidence` · `supportingEvidence` · `missingEvidence` · `clarificationRequired`.

---

## 4. Feature flag

| Flag | Default | Depends on |
|------|---------|------------|
| `ai.proactive_advisor` | **OFF** | `ai.multi_turn_conversation` |

Force via `proactiveAdvisorEnabled: true` on `createTravelAgentService`.

When OFF → production path identical (no proactive import unless forced).

When ON → after other enrichment layers, attach metadata only.

---

## 5. Package

`src/lib/agent/proactive/`

| File | Role |
|------|------|
| `types.ts` | Contracts + Voice/Knowledge/Memory extension interfaces |
| `proactiveRegistry.ts` | Flag + signal catalog |
| `proactiveSignals.ts` | Signal definitions / priorities |
| `proactiveContext.ts` | Read-only context bag |
| `proactiveDetector.ts` | Signal detection |
| `proactiveConfidence.ts` | Confidence + clarification |
| `proactivePriority.ts` | Ranking |
| `proactiveRecommendation.ts` | Recommendation builders |
| `proactiveAdvisor.ts` | Run + planTurn enrich |
| `index.ts` | Barrel |

---

## 6. Future integration points

| Center | Preparation |
|--------|-------------|
| **Voice Center** | `ProactiveVoiceHint` (`speakableSummary`, locale, urgency) — no playback |
| **Knowledge Center** | `ProactiveKnowledgeRef` (`entryId`, topic) — no fetch |
| **Memory Center** | `ProactiveMemoryAppend` (`mode: 'append'` only) — never overwrite |

---

## 7. Safety

- Never invent visa / weather / price facts  
- Never edit itineraries, destinations, pricing, or engine recommendations  
- Metadata attachment only  
