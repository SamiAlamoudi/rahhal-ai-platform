# AI Travel Strategy — Evolution Sprint 8

**Status:** Additive foundation · **Not** wired into `planTurn` · Flag `ai.travel_strategy` **default OFF**  
**Freeze:** Decision Engine · Planning Draft · Conversation Brain · Smart Clarification · Reflection · Recommendation · Traveler Intelligence · Destination Intelligence · Planning Graph · planTurn · Production Authority remain untouched.

This layer thinks like a senior travel consultant that optimizes **how** to travel. It does **not** choose destinations.

---

## 1. Role

| Layer | Responsibility |
|-------|----------------|
| Destination Intelligence | Supplies destination knowledge (priors) |
| Recommendation Intelligence | Supplies candidates |
| **Travel Strategy** | Decides timing, budget allocation, comfort, route, stay length |

Questions answered:

- Go now or later?
- Is increasing budget worth it?
- Would splitting the itinerary help?
- Should flights be adjusted (strategically)?
- Is comfort worth extra cost?
- Which compromise yields highest value?

---

## 2. Pipeline

```
TravelStrategyContext (duck-typed priors + known slots)
        │
        ├─ Season / Weather / Crowd / Holiday / Visa timing
        ├─ Budget / Opportunity cost / Comfort vs cost
        ├─ Travel timing / Stay duration / Flights / Hotels
        ├─ City split / Route / Risk
        │
        ▼
 TravelStrategyEngine → Primary + Alternative strategies by kind
        │
        ▼
 StrategyFormatter (AR/EN templates)
```

**Invariant:** Never invent facts. Missing month/budget/duration/priors → `missingInformation` + `suggestedClarification`. Low confidence → `collect_information`.

---

## 3. Strategy kinds

| Kind | Intent |
|------|--------|
| Primary | Balanced timing + budget + comfort |
| Alternative | Contrasting timing/split lever |
| Budget | Efficiency / reallocate / increase-when-needed |
| Comfort | Low friction, pay for ease |
| Luxury | Raise execution standard (same destination context) |
| Fastest | Minimize transfers / splits |
| Highest value | Timing + reallocation + stay length |
| Lowest risk | Conservative timing, flexibility, visa buffer |
| Best time | Season / crowd / visa driven timing |

Each option includes: Why, Why not, Trade-offs, Risks, Opportunity cost, Expected value, Confidence, Evidence, Missing information, Suggested clarification, scored dimensions, levers.

---

## 4. Scoring dimensions

Budget · Comfort · Time · Convenience · Experience · Weather · Crowds · Transportation · Flexibility · Overall Value · Confidence

---

## 5. Performance

| Concern | Sprint 8 |
|---------|----------|
| Network / LLM / API | **None** |
| planTurn wiring | **None** |
| Default flag | **OFF** |
| Runtime chat cost while OFF | **Zero** |
| Coupling | Duck-typed context — no hard imports of Destination/Recommendation packages into the engine core |

---

## 6. Tests

`src/lib/__tests__/travelStrategy.sprint8.test.ts`
