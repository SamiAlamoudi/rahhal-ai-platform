# User Journeys — Sprint 88 Alpha Validation

**Companion to:** `docs/ALPHA_READINESS_REPORT.md`  
**Path under test:** `/chat` → `travelAgentService.planTurn` (default travel-agent provider)  
**Mode:** Mock providers (production default)

---

## How to read this document

Each journey records:

- **Traveler intent** (what a real person would say)
- **Expected Alpha behavior**
- **Observed behavior** (2026-07-22 validation)
- **Verdict**

---

## Journey 1 — Family Vacation (Saudi Arabia → Paris)

**Prompt:** Family vacation from Saudi Arabia to Paris, budget 15,000 SAR, 2 adults + 2 children, flights, hotels, activities, 7 days next month.

| Expectation | Observation |
| --- | --- |
| Detect family purpose | ✓ `tripPurpose=family` |
| Travelers = 4 | ✓ |
| Budget = 15000 | ✓ |
| Flights + hotels in plan | ✓ trip plan / booking-ready under mock |
| Activities | Shallow — mock attractions if tools run; not deep package activities |
| Strategy + decision | ✓ planner + decision meta present |
| Packages | ✗ `dynamicPackages` often null (needs both offer pools) |

**Verdict:** PASS (mock family path works; package/activity depth limited)

---

## Journey 2 — Business Trip (Riyadh → London)

**Prompt:** Business trip Riyadh → London, flexible dates, fastest arrival, 3 days, 12,000 SAR.

| Expectation | Observation |
| --- | --- |
| Business purpose | ✓ |
| Flexible dates respected in strategy | ✓ planner runs; flexible slot available |
| Fastest / time priority | Partial — decision labels can prefer fastest when pools exist |
| Price intelligence | ✓ observed on this journey |

**Verdict:** PASS

---

## Journey 3 — Luxury Honeymoon (Maldives)

**Prompt:** Luxury honeymoon Maldives, luxury resort, private villa, 7 days, 45,000 SAR from Riyadh.

| Expectation | Observation |
| --- | --- |
| Honeymoon purpose | ✓ |
| Luxury / villa preference | Partial — purpose + budget captured; villa is not a hard inventory constraint under mock |
| High budget retained | ✓ 45000 |

**Verdict:** PASS (intent); WARNING (luxury inventory fidelity)

---

## Journey 4 — Budget Traveler (Turkey)

**Prompt:** Budget Turkey, lowest total cost, 5 days from Jeddah, 4,000 SAR.

| Expectation | Observation |
| --- | --- |
| Commit to lowest-cost recommendation | ✗ Often asks who is traveling instead |
| Decision / packages | ✗ missing on clarifying turns |
| Destination Istanbul | ✓ when destination resolved |

**Verdict:** WARNING

---

## Journey 5 — Change destination mid-conversation

**Turn 1:** Plan Paris…  
**Turn 2:** Actually change destination to Rome instead.

| Expectation | Observation |
| --- | --- |
| Primary destination = Rome | ✓ |
| Prior Paris cleared | ✗ `destinations` becomes `Paris,Rome` (accumulated) |
| Plan regenerates for Rome | ✓ |

**Verdict:** WARNING

---

## Journey 6 — Double the budget

**Turn 1:** Istanbul · 6,000 SAR  
**Turn 2:** Budget is now 12,000 SAR

| Expectation | Observation |
| --- | --- |
| Budget updates | ✓ 12000 |
| Re-plan / re-enrich | ✓ new plan turn |

**Verdict:** PASS

---

## Journey 7 — Reduce budget below feasibility

**Turn 1:** Family Paris · 20,000 SAR  
**Turn 2:** Change budget to only 1,500 SAR

| Expectation | Observation |
| --- | --- |
| Budget = 1500 | ✓ |
| Explain infeasibility + closest solution | ✗ weak |
| Destination stays Paris | **FAIL** — destination becomes **"Only"** |

**Verdict:** FAIL (extraction corruption)

---

## Journey 8 — Reject recommendation

**Turn 2:** “No, not this. I changed my mind — show something else”

| Expectation | Observation |
| --- | --- |
| Recover without full restart | Partial — conversation continues |
| Ranked alternatives | Weak — regenerates Dubai-centric plan |
| Constitution recovery checklist | Not enforced |

**Verdict:** WARNING

---

## Journey 9 — Change hotel class

**Turn 1:** 3-star London  
**Turn 2:** Change to 5-star luxury

| Expectation | Observation |
| --- | --- |
| Hotel class preference updates | Partial / weakly evidenced |
| Plan refreshes | ✓ |

**Verdict:** WARNING

---

## Journey 10 — Impossible itinerary

**Prompt:** Same-morning RUH↔JFK, 5 cities, 500 SAR, luxury everything.

| Expectation | Observation |
| --- | --- |
| Never say impossible/wrong/cannot | ✓ (phrasing) |
| Explain constraints + closest achievable | ✗ mostly clarifies missing slots |
| Alternatives | Weak |

**Verdict:** WARNING

---

## Journey 11 — Flight becomes unavailable

**Turn 2:** “The flight is unavailable — find another flight”

| Expectation | Observation |
| --- | --- |
| Airline / nearby airport recovery | Soft regenerate only |
| Continue without empty failure | ✓ reply continues |

**Verdict:** WARNING

---

## Journey 12 — Hotel unavailable

**Turn 2:** “That hotel is unavailable, find another hotel”

| Expectation | Observation |
| --- | --- |
| Hotel alternatives | Weak |
| Keep context | ✗ often re-asks when / nights; planner/decision may drop |

**Verdict:** WARNING

---

## Journey 13 — Change travel dates

**Turn 2:** “Change dates to April instead”

| Expectation | Observation |
| --- | --- |
| Dates move to April | Unclear / not cleanly asserted |
| Destination stays Amman | **FAIL** — destination **"April Instead"** |

**Verdict:** FAIL (extraction corruption)

---

## Journey 14 — Change number of travelers

**Turn 2:** “Make it 4 adults instead”

| Expectation | Observation |
| --- | --- |
| Travelers = 4 | ✓ |

**Verdict:** PASS

---

## Journey 15 — Interrupt then resume

**Turn 2:** Stop — continue later  
**Turn 3:** I’m back — continue Morocco plan

| Expectation | Observation |
| --- | --- |
| Preserve Morocco context | ✓ destination/budget/travelers retained in message memory |
| No full restart required | ✓ |

**Verdict:** PASS (same conversation); cross-device persistence not validated

---

## Journey summary

| Pass | Warning | Fail |
| ---: | ---: | ---: |
| 6 | 7 | 2 |

Fails are **intent-extraction destination corruption** on common edit phrasing — highest-priority Alpha UX risk.
