# AI Travel Intelligence Layer — Phase 3 Stage 4

**Status:** Additive isolated evaluation layer · Flag `ai.travel_intelligence` **default OFF**  
**Freeze:** Production planning · `planTurn` · tripPlan · destinations · pricing · itinerary · Runtime Coordinator · Consultant Pipeline · Unified Response · Conversation Orchestrator · Multi-Turn Manager · Proactive Advisor.

The Travel Intelligence Layer evaluates multiple travel options **before** a consumer presents a final response. It compares alternatives, explains trade-offs, scores confidence, ranks options, and justifies decisions — as **metadata only**.

---

## 1. Isolation rule

This stage is **not wired into `planTurn()`**.

Consumers call:

- `runTravelIntelligence(...)`
- `tryRunTravelIntelligence(...)`
- `enrichTurnWithTravelIntelligence(turn, options)` → attaches `meta.travelIntelligence` only

When the flag is OFF (default), production behavior is identical because `planTurn` is unchanged.

---

## 2. Behavior

Evaluates (relative signals, never live booking/pricing):

| Dimension | Role |
|-----------|------|
| price | Relative cost signal (not real fares) |
| duration | Length fit |
| convenience | Ease of travel |
| visa difficulty | Relative entry complexity (not legal advice) |
| weather suitability | Seasonal heuristic (not a forecast) |
| family / business / accessibility | Suitability cues |
| preference + conversation fit | Context alignment |

Produces: alternatives · comparisons · trade-offs · ranked recommendations · explanation · confidence.

---

## 3. Output

**Only** `meta.travelIntelligence` (via enrich helper).

Never edits: `tripPlan` · planning graph · runtime coordinator · consultant response · conversation reply.

---

## 4. Feature flag

| Flag | Default | Depends on |
|------|---------|------------|
| `ai.travel_intelligence` | **OFF** | `ai.proactive_advisor` |

---

## 5. Package

`src/lib/agent/intelligence/`

| File | Role |
|------|------|
| `types.ts` | Contracts + Voice/Knowledge/Memory interfaces |
| `intelligenceRegistry.ts` | Flag + dimensions |
| `alternativeGenerator.ts` | Candidate alternatives + context |
| `travelComparator.ts` | Dimension comparison |
| `decisionScoring.ts` | Weighted decision scores |
| `confidenceEngine.ts` | Confidence |
| `tradeoffAnalyzer.ts` | Trade-off insights |
| `rankingEngine.ts` | Ranking |
| `explanationBuilder.ts` | Justifications + explanation |
| `travelIntelligence.ts` | Run + enrich (meta-only) |
| `index.ts` | Barrel |

---

## 6. Future integration points

| Center | Preparation |
|--------|-------------|
| **Voice Center** | `TravelVoiceSummary` — no speech/playback/TTS |
| **Knowledge Center** | `KnowledgeReference` — references only, never load books |
| **Memory Center** | `IntelligenceMemoryAppend` (`mode: 'append'`) — never overwrite |

---

## 7. Safety

- Never invents prices, visa approvals, or weather forecasts  
- Never changes planning or destinations  
- Metadata evaluation only  
- `planTurn` untouched in this stage  
