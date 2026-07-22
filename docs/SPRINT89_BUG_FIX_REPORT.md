# Sprint 89 — Bug Fix Report

**Objective:** Remove Alpha blockers identified in Sprint 88. No new engines. No redesign.

---

## Priority 1 — Intent Extraction

### Bugs

| ID | Symptom | Root cause |
| --- | --- | --- |
| EXT-01 | “only 1500 SAR” → destination `Only` | Free-text `to/in` cue captured filler `only` |
| EXT-02 | “April instead” → destination `April Instead` | Month + `instead` accepted as place |
| EXT-03 | Paris retained after “change to Rome” | `mergeRequirements` always unioned destinations |
| EXT-04 | `budget is only 1500` missed amount | Budget regex rejected filler between cue and digits |

### Fixes

**File:** `src/lib/agent/extractRequirements.ts`

- Expanded destination stopwords / invalid token guards (months, only/just/instead, numerics)
- Hardened `to/in` cue denylist and lookahead (`instead`)
- Budget regex allows `only|just|about|around`
- `flags.replaceDestinations` on change/instead cues
- Hotel class extraction for explicit `N-star` (without clobbering boutique via bare “luxury”)

**File:** `src/lib/agent/memory.ts`

- `mergeRequirements(..., { replaceDestinations })` replaces list when flagged

**Tests:** `src/lib/__tests__/intentExtraction.sprint89.test.ts`

---

## Priority 2 — Constitution wiring

### Bug

Constitution library existed (S87) but was **never called** from `travelAgentService.planTurn`.

### Fix

- New bridge: `src/lib/agent/constitution/` (`applyConstitutionToTurn`)
- Invoked on every planning turn before/after Conversation Brain
- Attaches `meta.constitution` (ok, violations, recovery counts, confidence)
- Injects recommendation + recovery facts into `buildTravelFacts`

**Flag:** `ai.constitution` (default ON) — now actually exercised live.

---

## Priority 3 — Package Builder silent skip

### Bug

`enrichWithDynamicPackages` returned `dynamicPackages: null` with **no notes** when flight or hotel pools were empty.

### Fix (`src/lib/agent/packageBuilder/bridge.ts`)

Fallback order:

1. Full packages when both pools present  
2. Flight-first partial  
3. Hotel-first partial  
4. Manual explanation + recovery narrative when both empty  

Never terminates silently — always returns a `PackageBuilderResult` + trip notes.

---

## Priority 4 — Recovery

### Bug

Empty / rejection paths did not surface Constitution recovery checklist to the traveler.

### Fix

- `collectRecoveryAttempts` / full checklist on no-results & rejection  
- Recovery notes injected into recommendations/warnings  
- Reply sanitizes bare “no results” when no plan exists  

---

## Priority 5 — Recommendation quality

### Bug

Plans often lacked explicit Reason / Trade-offs / Confidence / Alternatives / Next action.

### Fix

- Constitution bridge emits structured fact lines  
- `buildTravelFacts` parses them onto plan facts  
- `localConversationModel` renders Why / Trade-offs / Confidence / Alternatives / Next action sections  

---

## Out of scope (documented, not fixed)

- Sprint 84 Itinerary Refinement merge  
- Live provider / payment unfreeze  
- Durable multi-device learning DB  
- Generative LLM conversation rewrite  
