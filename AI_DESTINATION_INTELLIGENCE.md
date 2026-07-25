# AI Destination Intelligence — Evolution Sprint 7

**Status:** Additive foundation · **Not** wired into `planTurn` · Flag `ai.destination_intelligence` **default OFF**  
**Freeze:** All existing AI cores · planTurn · Production Authority · Smart Clarification remain untouched.

Rahhal understands destinations as a **travel consultant** would — seasonality, traveler fit, strengths/weaknesses — not merely as searchable place labels.

---

## 1. Destination model

```
DestinationKnowledgeRecord (offline curated)
        │
        ├─ DestinationProfile          (locale-aware view)
        ├─ Analyzers                   (climate, season, crowd, safety, transit, …)
        ├─ DestinationSummary          (DNA, snapshot, match, avoid)
        └─ DestinationComparator       (pairwise compare)
                │
                ▼
        DestinationIntelligence.run → Snapshot (+ optional Comparison)
```

Each destination stores: best/worst seasons, weather patterns, crowd levels, typical traveler profiles, family/luxury/adventure/food/shopping/walking scores, transportation quality, safety indicators, cost expectations, recommended stay duration, strengths, weaknesses, visa complexity, evidence, missing knowledge, confidence.

Catalog includes (among others): Japan, Korea, Paris, Rome, Bali, Phuket, Morocco, Spain, Istanbul, Dubai — enough for the mission comparison pairs.

---

## 2. Scoring

Dimension scores are **qualitative offline priors** (0–100), not live ratings:

| Family · Luxury · Adventure · Food · Shopping · Walking · Transit |
| Nightlife · Photography · Nature · City · Accessibility |

Composite snapshot `overall` blends traveler match, season fit, budget fit, safety band, and knowledge confidence.

---

## 3. Traveler matching

`matchTravelerScore(record, travelerHints, monthHint)` weights:

- Purpose (family / honeymoon / adventure / cultural)
- Lean hints (luxury, adventure, food, nature, city)
- Risk tolerance vs safety band
- Budget stance vs cost band
- Interests tags
- Season fit for month hint

Outputs reasons + avoid reasons. Never invents live availability.

---

## 4. Seasonal reasoning

`SeasonAnalyzer` marks months as best / good / mixed / poor / worst using curated `bestSeasons` / `worstSeasons` + climate labels, and attaches crowd priors per month.

---

## 5. Comparison logic

`compareDestinations(A, B, traveler?)` diffs key dimension scores, cost/visa bands, strengths, weaknesses, and optional traveler-match preference (Japan vs Korea, Paris vs Rome, Bali vs Phuket, Morocco vs Spain supported).

Near ties → `winnerId: null`.

---

## 6. Snapshot outputs

| Field | Meaning |
|-------|---------|
| Destination DNA | Primary character + secondary traits + climate/cost/pace genes |
| Strengths / Weaknesses | From curated knowledge |
| Best traveler match | Typical profiles + high-score seekers |
| Who should avoid | Cost/adventure/nature/visa/walking mismatches |
| Confidence / Evidence / Missing knowledge | Explicit uncertainty |

---

## 7. Performance / production

| Concern | Sprint 7 |
|---------|----------|
| Network / external APIs / LLM | **None** |
| planTurn wiring | **None** |
| Default flag | **OFF** |
| Runtime chat | **Unchanged** |
| CPU | In-memory catalog lookup + scoring |

---

## 8. Tests

`src/lib/__tests__/destinationIntelligence.sprint7.test.ts` — Arabic, English, comparisons, matching, seasonality, regression.
