# Test Scenarios — Sprint 88 Alpha Validation

**Companion to:** `docs/ALPHA_READINESS_REPORT.md`, `docs/USER_JOURNEYS.md`  
**Scope:** Acceptance scenarios for mock-mode Alpha. Not a new test framework.

---

## How to re-run validation

```bash
# Core Alpha traveler matrix (plan → book → pay)
npm run test:run -- src/lib/__tests__/alphaQa.scenarios.test.ts

# Full conversational Alpha journeys
npm run test:run -- src/lib/__tests__/rahhalAlpha.journey.test.ts src/lib/__tests__/alpha-morocco-journey.test.ts

# Pipeline unit suites (planner / packages / constitution)
npm run test:run -- \
  src/lib/__tests__/travelPlanner.sprint78.test.ts \
  src/lib/__tests__/packageBuilder.sprint83.test.ts \
  src/lib/__tests__/aiConstitution.sprint87.test.ts

# Governance verify
npm run constitution:verify

# Full CI-equivalent unit suite
npm run test:run
```

**Sprint 88 validation run:** related suites **95/95 passed**; full suite expected green on mock defaults (no broad `.env.local` provider overrides).

---

## Scenario matrix

| ID | Scenario | Type | Automated coverage | Manual / planTurn probe | Result |
| --- | --- | --- | --- | --- | --- |
| S01 | Family vacation Paris 15k + children | Happy path | `alphaQa` family Dubai analogue | Journey 1 | PASS |
| S02 | Business London flexible fastest | Happy path | `alphaQa` business London | Journey 2 | PASS |
| S03 | Luxury Maldives honeymoon | Happy path | `alphaQa` luxury Maldives | Journey 3 | PASS |
| S04 | Budget Turkey lowest cost | Happy path | `alphaQa` budget Cairo analogue | Journey 4 | WARNING |
| S05 | Destination change Paris→Rome | Edit | Partial (multi-city alphaQa) | Journey 5 | WARNING |
| S06 | Budget doubled | Edit | — | Journey 6 | PASS |
| S07 | Budget cut below feasibility | Stress | — | Journey 7 | FAIL |
| S08 | Reject recommendation | Recovery | Soft autonomous retries | Journey 8 | WARNING |
| S09 | Hotel class upgrade | Edit | — | Journey 9 | WARNING |
| S10 | Impossible itinerary | Stress | — | Journey 10 | WARNING |
| S11 | Flight unavailable | Recovery | Provider failover library tests | Journey 11 | WARNING |
| S12 | Hotel unavailable | Recovery | Provider failover library tests | Journey 12 | WARNING |
| S13 | Date change to April | Edit | — | Journey 13 | FAIL |
| S14 | Traveler count change | Edit | — | Journey 14 | PASS |
| S15 | Interrupt + resume | Session | Memory rebuild in agent | Journey 15 | PASS |
| S16 | Arabic conversation | Locale | `alphaQa` Arabic | Covered | PASS |
| S17 | English conversation | Locale | `alphaQa` English | Covered | PASS |
| S18 | Multi-city | Happy path | `alphaQa` Paris+Rome | Covered | WARNING |
| S19 | Mock providers default | Ops | CI / verify scripts | Covered | PASS |
| S20 | Live providers | Ops | Secrets absent | Not covered | FAIL |
| S21 | Constitution on turn | Governance | Unit only (`aiConstitution`) | Not in `planTurn` | FAIL |
| S22 | Package builder on thin pools | Pipeline | Unit when both pools present | Often skips live | WARNING |
| S23 | Itinerary refinement | Pipeline | Branch S84 only | Not on main | FAIL |
| S24 | Plan→book→pay mock | Booking | Alpha QA + Morocco | Covered | PASS |

---

## Evaluation rubric (per journey)

Score each dimension 0–100, then map:

| Band | Label |
| --- | --- |
| ≥ 80 | PASS |
| 55–79 | WARNING |
| < 55 | FAIL |

Dimensions: Conversation · Intent · Questions · Strategy · Search · Price Intel · Packages · Recommendation · Explanation · Alternatives · Recovery · Constitution · Learning · Mission Alignment.

---

## Suggested traveler scripts (copy/paste)

### Family

> Family vacation from Saudi Arabia to Paris, budget 15000 SAR, 2 adults and 2 children, need flights hotels and activities, 7 days next month

### Business

> Business trip from Riyadh to London, flexible dates next month, I need the fastest arrival, 3 days, budget 12000 SAR

### Honeymoon

> Luxury honeymoon in Maldives, luxury resort with private villa, 7 days, budget 45000 SAR from Riyadh

### Budget

> Budget trip to Turkey, lowest total cost possible, 5 days from Jeddah, budget 4000 SAR

### Corruption repros (must stay red until fixed)

> Change budget to only 1500 SAR  
> Change dates to April instead

---

## Out of scope for Sprint 88

- Implementing fixes (tracked in `TOP20_ALPHA_IMPROVEMENTS.md`)
- Live Amadeus/Booking credentialed runs
- Playwright matrix for all 15 journeys (library `planTurn` used instead)
- New AI engines or architecture changes
