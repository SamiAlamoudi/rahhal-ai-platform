# Weaknesses — Sprint 88 Alpha Validation

**Status:** Discovery only. No product fixes in Sprint 88 unless a blocker prevented validation (none did).  
**Companion:** `docs/TOP20_ALPHA_IMPROVEMENTS.md`

---

## Top 20 weaknesses

| # | Weakness | Impact | Severity |
| ---: | --- | --- | --- |
| 1 | Intent extraction can set destination from filler words (“only”, “instead”, month names) | Corrupts plan mid-conversation | **P0** |
| 2 | Rahhal Constitution not invoked on live `planTurn` | Governance is documentation/unit-only | **P0** |
| 3 | Package Builder returns null when flight **or** hotel pool empty | Pipeline stage silently skipped | **P1** |
| 4 | Itinerary Refinement (Sprint 84) not on `main` | Product diagram incomplete | **P1** |
| 5 | Price Intelligence runs after Decision Engine | Timing advice does not shape the chosen plan | **P1** |
| 6 | Destination list accumulates on change (Paris retained after Rome) | Confusing multi-city bleed | **P1** |
| 7 | Rejection (“No / not this”) lacks ranked alternative recovery | Feels stubborn / restart-ish | **P1** |
| 8 | Impossible requests mostly clarify slots instead of constraints + closest fit | Mission/Constitution gap | **P1** |
| 9 | Hotel/flight “unavailable” utterances do not trigger structured recovery attempts | Empty-result principle unmet | **P1** |
| 10 | Mock-only inventory for Alpha success | False confidence vs live availability | **P0** (live Alpha) |
| 11 | Payments frozen mock | Cannot validate real money path | Accepted freeze |
| 12 | Conversation Brain is rule/template — not generative LLM by default | Feels non-ChatGPT | **P2** |
| 13 | Learning is local PreferenceStore only | No durable cross-device profile | **P2** |
| 14 | Budget-below-feasibility lacks hard “closest achievable” negotiation | Over-promises then underserves | **P1** |
| 15 | Hotel class edits weakly reflected in traveler-facing text | Preference not clearly honored | **P2** |
| 16 | Activities/transfers rarely appear in live package path | Family journey incomplete | **P2** |
| 17 | Dual decision stacks (Sprint 79 core vs legacy agent decision) | Inconsistent explainability | **P2** |
| 18 | Resume-after-interrupt depends on in-thread message rebuild | Cross-session resume unproven | **P2** |
| 19 | Constitution `ai.constitution` flag does not gate engines when OFF/ON | Flag is cosmetic for runtime | **P2** |
| 20 | SYSTEM_STATUS / some sprint docs lag behind S75–S87 wiring | Ops confusion | **P3** |

---

## Weaknesses by pipeline stage

### Conversation
- Template openings (“I put together a first cut…”) repeat across destinations.
- Weak handling of rejection and impossibility tone beyond avoiding banned words.

### Intent extraction
- **Critical:** edit phrases mutate destination.
- Traveler count / budget updates work more reliably than date phrasing.

### Strategy Planner
- Generally healthy; depends on clean requirements upstream.

### Search
- Strong under mock; live path unvalidated for Alpha.

### Price Intelligence
- Synthetic history; intermittent attachment; post-decision placement.

### Package Builder
- Correctly designed to need both pools — but live turns often lack one pool → stage disappears without traveler explanation.

### Itinerary Refinement
- Absent on main.

### Decision Engine
- Works when enrichment runs; inherits thin upstream inputs.

### Learning
- Early-turn adaptation present; opaque to traveler; not Constitution-aware.

### Constitution
- Principles defined; **zero** live enforcement points found in agent orchestration.

---

## Bugs discovered (document only)

| Bug | Repro | Expected | Actual |
| --- | --- | --- | --- |
| Destination = “Only” | “…budget to only 1500 SAR” | Stay on prior destination; update budget | `destination: Only` |
| Destination = “April Instead” | “Change dates to April instead” | Update dates; keep Amman | `destination: April Instead` |
| Packages skipped silently | Typical first-cut planTurn | Traveler sees package choice or explicit skip reason | `dynamicPackages` absent in meta |
| Constitution unused | Any `/chat` turn | Optional validate + recovery | No import from `travelAgentService` |

---

## What is *not* a weakness for mock Alpha

- Mock payments / mock providers as **defaults** (intentional product freezes).
- Presence of feature flags default ON for S75–S83 libraries.
- Clarifying questions when travelers unspecified (Journey 4) — good behavior, but conflicts with “lowest cost now” expectation.
