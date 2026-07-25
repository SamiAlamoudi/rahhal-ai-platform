# End-to-End Journey — Complete Examples (Sprint 12)

**Branch:** `cursor/e2e-journey-integration-7518`  
**Draft PR:** _(pending)_  
**Flag:** `ai.integration_journey` (default OFF)

---

## Mission chain

Conversation → Intent → Planner → Destination → Flights → Hotels → Budget → Orchestrator → Maps → Companion → Action → Disruption → Completion

---

## Scenario matrix

| Scenario | Cue | Journey focus |
|---|---|---|
| Business traveler | `travelerType=business` | Timeline + flights + action |
| Family vacation | `travelerType=family` | Hotels + budget + companion |
| Luxury trip | `budgetStyle=luxury` | Preference-weighted decision |
| Weekend trip | `durationDays≤3` | Fast planner → action |
| Budget trip | `budgetStyle=budget` | Budget stage emphasis |
| Multi-city | multiple destinations | Orchestrator handoff |
| Disruption recovery | “flight delayed / missed connection” | Disruption stage + elevated risk |

---

## Full conversation arc

| Step | Traveler | Stage |
|---|---|---|
| Plan | “Plan my trip to Dubai.” | `planner` |
| Modify | hotel preference change | `hotels` |
| Book | “Book it.” | `action` |
| Travel | “What’s next?” | `companion` |
| Recover | “I missed my connection.” | `disruption` |
| Complete | “Trip complete.” | `completion` |

Known slots (destination, budget, flights, hotels, …) are carried in handoff — **no duplicated questions**.
