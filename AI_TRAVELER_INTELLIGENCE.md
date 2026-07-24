# AI Traveler Intelligence — Evolution Sprint 5

**Status:** Additive foundation · **Not** wired into `planTurn` · Flag `ai.traveler_intelligence` **default OFF**  
**Freeze:** Decision Engine · Planning Draft · Conversation Brain · Smart Clarification · Production Authority · `planTurn` · Reasoning · Reflection · PlanningGraph sources remain untouched.

This is an **evolving behavioral model**, not a CRM user profile. Rahhal learns travel style continuously from conversation with weighted confidence updates.

---

## 1. Behavior inference

```
user text (+ optional reasoningRef / reflectionRef / conversationSource)
        │
        ▼
 BehaviorAnalyzer
   ├─ TravelStyleAnalyzer
   ├─ BudgetBehaviorAnalyzer
   ├─ RiskToleranceAnalyzer
   ├─ ComfortAnalyzer
   ├─ PaceAnalyzer
   ├─ FoodPreferenceAnalyzer
   ├─ ActivityPreferenceAnalyzer
   ├─ SeasonPreferenceAnalyzer
   ├─ DestinationAffinity
   ├─ walking / transit (mobility)
   ├─ nightlife / photography / family (social)
   └─ decision confidence
        │
        ▼
 PreferenceSignal[]  →  PreferenceEvolution  →  TravelerModel.preferences
        │
        ▼
 TravelerSummary → Snapshot / Personality / Travel DNA / Planning Bias / Recommendation Bias
```

Inferred dimensions include: travel style, budget flexibility, luxury, adventure, nature vs cities, transit/walking tolerance, climate, food exploration, shopping, family friendliness, photography, nightlife, activity density, decision confidence, risk, comfort, pace, season, destination affinity.

---

## 2. Confidence evolution

Every preference stores:

| Field | Meaning |
|-------|---------|
| Confidence | 0–1 strength of belief |
| Evidence | Accumulated `PreferenceEvidenceItem`s |
| Timestamp | `updatedAt` on the stored preference; evidence items have their own timestamps |
| Conversation source | Turn / channel id |
| Reasoning reference | Opaque Sprint 1 ref (optional) |
| Reflection reference | Opaque Sprint 2 ref (optional) |

**Update rule (never hard-overwrite):**

```
priorW  = prior.confidence * 0.65
signalW = signal.confidence * (conflict ? 0.45 : 0.35)
lean    = weighted average by priorW/signalW
confidence = clamp(prior*0.65 + signal*0.35 + agreementBonus)
```

Value labels change only when the new signal is competitively strong; weak contradictions pull lean without replacing the label.

Overall model confidence = preference average × breadth − contradiction penalty (`TravelerConfidence`).

---

## 3. Evidence accumulation

`PreferenceEvidence.create` attaches text + source + refs + weight.  
`mergeEvidence` appends uniquely (capped).  
`TravelerModel.evidenceLog` keeps a global rolling log across turns.

---

## 4. Preference conflicts

When a new signal conflicts with a strong prior (opposite high/low, nature/cities, packed/relaxed, or large lean gap):

1. Prior value is pushed into `contradictions[]` (audit, not deleted).
2. Lean blends toward the new signal with a lower weight.
3. Label flips only if the new signal confidence clearly exceeds the prior.

This supports travelers who change their mind mid-conversation without erasing history.

---

## 5. Travel DNA & outputs

| Output | Role |
|--------|------|
| **Traveler Snapshot** | Full export: preferences + biases + confidence |
| **Traveler Personality** | Trait list + short summary (AR/EN) |
| **Travel DNA** | Genes: style, budget, pace, risk, place, food, activity, climate + signature |
| **Planning Bias** | Flexible dates, value-over-cheap, low friction, comfort, clarify aggressiveness |
| **Recommendation Bias** | Destination favors, avoided themes, dimension weights |

---

## 6. API

| Entry | Role |
|-------|------|
| `TravelerModel.create` / `tryCreate` | Session model (gated) |
| `TravelerModel.observe` / `tryObserve` | Ingest a turn |
| `TravelerSummary.snapshot` | Build snapshot |
| `isTravelerIntelligenceEnabled` | Feature gate |

---

## 7. Performance / production

| Concern | Sprint 5 |
|---------|----------|
| Network / LLM / API | **None** |
| planTurn wiring | **None** |
| Default flag | **OFF** |
| Runtime chat behavior | **Unchanged** |
| CPU | Regex analyzers + in-memory blends |

---

## 8. Tests

`src/lib/__tests__/travelerIntelligence.sprint5.test.ts` — Arabic/English conversations, evolution, contradictions, confidence, regression.
