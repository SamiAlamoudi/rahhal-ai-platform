# Disruption Recovery — Scenario Examples (Sprint 10)

**Branch:** `cursor/live-disruption-recovery-7518`  
**Draft PR:** [#274](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/274)  
**Flag:** `ai.integration_disruption_recovery` (default OFF)

---

## 1. Flight delay

**Traveler:** “My flight is delayed 3 hours.”

| Field | Example |
|---|---|
| Kind | `flight_delay` |
| Risk | `high` (≥180 min) |
| Impact | timeline, hotel, transfers, meetings, activities |
| Primary | Best recovery (balanced rebook + check-in protect) |
| Alts | Cheapest / Fastest / Minimal / Premium |

---

## 2. Flight cancellation

**Traveler:** “My flight was canceled.”

| Field | Example |
|---|---|
| Kind | `flight_cancellation` |
| Risk | `high` |
| Overnight | likely |
| Budget | impacted |
| Replan | hotel check-in + transfers adjusted |

---

## 3. Missed connection

**Traveler:** “I missed my connection.”

| Field | Example |
|---|---|
| Kind | `missed_connection` |
| Risk | `high` / `critical` if delay ≥120 |
| Primary | Best or Fastest depending on scores |

---

## 4. Hotel canceled / overbooking

**Traveler:** “My hotel canceled.” / “Hotel overbooked us.”

| Field | Example |
|---|---|
| Kind | `hotel_overbooking` |
| Impact | hotel + budget + timeline |
| Steps | relocate / guaranteed late check-in / premium relocation |

---

## 5. What should I do now?

**Traveler:** “What should I do now?”

Soft guidance if no disruption text yet — asks for delay / connection / hotel details, then builds plans.

---

## 6. Gate change / late check-in / activity / weather

| Utterance | Kind | Typical risk |
|---|---|---|
| “Gate change to B12” | `gate_change` | low |
| “Late check-in after midnight” | `late_check_in` | medium |
| “Activity cancelled today” | `activity_cancellation` | low |
| “Storm weather delay” | `weather_disruption` | high |
