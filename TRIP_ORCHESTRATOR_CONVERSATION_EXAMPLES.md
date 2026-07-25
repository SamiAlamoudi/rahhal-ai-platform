# Trip Orchestrator — Conversation Examples (Sprint 4)

Flag `ai.integration_trip_orchestrator` remains **OFF** by default.

---

## Example 1 — Morocco next week

**Traveler:** I want to visit Morocco next week.

**Orchestrator:**
1. Extract destination + flexible dates  
2. Ask only missing slots (origin / travelers / budget if needed)  
3. Parallel flight + hotel search  
4. Budget split + combo recommendation  
5. Itinerary outline + consultant summary  

**Reply shape (illustrative):**
```
I put together a trip to Morocco:
Flight: SV · 1800 SAR. Why: Non-stop and competitive price
Hotel: Casa Business Suites · 550 SAR. Why: Includes breakfast and free cancellation
Why this combo: Flight and stay align on timing and your priorities…
Budget: I split your ~8000 SAR budget as: flights … · hotels … · buffer …
6-day outline ready (arrival → stay → return).
Trade-offs: A cheaper flight may add a stop…
Shall we proceed with this option, or adjust budget/dates?
```

---

## Example 2 — Family

**Traveler:** Family trip to Dubai, 2 adults + 2 kids, midrange.

**Scenario:** `family`  
Hotels prefer family-friendly amenities; budget midrange shares; rooms inferred.

---

## Example 3 — Business

**Traveler:** Business trip to Casablanca next Monday, back Thursday.

**Scenario:** `business`  
Central / business hotel bias via prefs; shorter itinerary; morning flight preference when set.

---

## Example 4 — Luxury / Budget / Weekend / Multi-city

| Scenario | Trigger cues |
|---|---|
| luxury | budgetStyle luxury / honeymoon |
| budget | budgetStyle budget |
| weekend | duration ≤ 3 or flexible short trip |
| multi_city | multiple destinations |

---

## Incomplete ask

**Traveler:** Plan a trip for me.  
**Orchestrator:** Asks destination only (not a full interview).
