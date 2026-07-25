# Maps & Live Mobility — Scenario Examples (Sprint 8)

**Draft PR:** [#272](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/272)  
Flag `ai.integration_maps_mobility` remains **OFF** by default.

---

## Scenario 1 — Where am I?

**Traveler:** Where am I?

**Rahhal:** Uses hotel/city spatial context from the trip plan.  
Example: `You’re around Casa Business Suites in Casablanca. (Mock spatial layer)`

---

## Scenario 2 — How do I get there?

**Traveler:** How do I get to the airport by transit?

**Rahhal:** Builds mock route hotel → airport with duration, distance, leave-by, and mode alternatives (walking / driving / taxi).

---

## Scenario 3 — Nearby

**Traveler:** Suggest something nearby

**Rahhal:** Lists nearby catalog places with walk minutes (Hassan II Mosque, airport, city center, …).

---

## Scenario 4 — From / to

**Traveler:** How do I get from Casa Business Suites to Hassan II Mosque?

**Rahhal:** Geocodes endpoints → primary route + alternatives.

---

## Scenario 5 — Live adapter without credentials

Live provider id is `google_maps_live`, but with no injected client it falls back to mock results so the conversation never hard-fails.

---

## Flag OFF regression

Maps package is not loaded; companion nearby fallback (Sprint 7) and legacy planTurn remain unchanged.
