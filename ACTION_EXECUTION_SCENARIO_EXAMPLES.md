# Action Execution — Scenario Examples (Sprint 11)

**Branch:** `cursor/action-execution-layer-7518`  
**Draft PR:** _(pending)_  
**Flag:** `ai.integration_action_execution` (default OFF)

---

## 1. Book it (preview → confirm → mock)

| Turn | Traveler | Result |
|---|---|---|
| 1 | “Book it.” | Preview · pending · asks for confirmation |
| 2 | “confirm” | Mock book via Provider Runtime · `mock_order_*` |

No live booking.

---

## 2. Reserve this hotel

Same confirmation gate (`booking`). Preview first; mock reserve after confirm.

---

## 3. Cancel my booking

| Field | Value |
|---|---|
| Confirmation kind | `cancellation` |
| Preview mode | `preview` |
| After confirm | Mock `cancel` on Provider Runtime |

---

## 4. Change my return flight

| Field | Value |
|---|---|
| Action | `modify_booking` |
| After confirm | Mock `refresh` / modification preview |

---

## 5. Share / save itinerary

| Action | Confirmation | Mode |
|---|---|---|
| Save itinerary | Not required | `mock` local |
| Share trip | Not required | `mock` local |

---

## 6. Decline

After “Book it.” → “no” clears pending; nothing booked.
