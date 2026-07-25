# Live Trip Companion — Scenario Examples (Sprint 7)

**Draft PR:** [#271](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/271)  
Flag `ai.integration_trip_companion` remains **OFF** by default.

---

## Scenario 1 — What should I do now?

**Traveler:** What should I do now?

**Companion:** Uses current/next timeline events + session state.  
Example: `Right now: Medina walk at Center. Next up: Business meeting.`

---

## Scenario 2 — Flight delay replan

**Traveler:** My flight delayed 90 minutes

**Companion:**
1. Detect `flight_delayed`
2. Shift cascade from outbound flight
3. Mark events `rescheduled`
4. Queue updated airport / boarding reminders
5. Reply with rebuilt timeline note

---

## Scenario 3 — Hotel unavailable

**Traveler:** Hotel unavailable tonight

**Companion:** Marks check-in as alternative-pending, shifts later activities, notes replan on TripPlan.

---

## Scenario 4 — Meeting changed

**Traveler:** Meeting changed by 45 minutes

**Companion:** Shifts meeting + following events; meeting reminder fire times move with the event.

---

## Scenario 5 — Skipped activity recovery

**Traveler:** I skipped the activity — what should I do now?

**Companion:** Marks current/next activity skipped, pulls later events forward (~20 min), answers what-now from the new next item.

---

## Scenario 6 — Am I late? / When should I leave?

| Ask | Behavior |
|---|---|
| Am I late? | Late/missed timeline scan; on-time otherwise |
| When should I leave? | Uses next flight; ~3h pre-departure guidance |

---

## Scenario 7 — Nearby (location prepared)

**Traveler:** Suggest something nearby.

**Companion:** Explains maps are not live yet; suggests short-walk style ideas from hotel/city context.

---

## Scenario 8 — Emergency framework

**Traveler:** I lost my passport

**Companion:** Steps + contact placeholders; `liveIntegration: false`.

---

## Flag OFF regression

Companion package not loaded for the turn; legacy planTurn / Smart Itinerary paths unchanged.
