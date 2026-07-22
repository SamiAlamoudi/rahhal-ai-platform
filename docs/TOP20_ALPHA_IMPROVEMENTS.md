# Top 20 Alpha Improvements — Before External Alpha

**Sprint 88 output · Implementation target: Sprint 89+**  
**Rule:** Sprint 88 does not implement these items.

Ordered by Alpha risk reduction (P0 first).

---

## 1. Harden intent extraction against filler / date phrases (P0)

Prevent destination capture from tokens like `only`, `instead`, month names when the utterance is clearly a budget/date edit.

**Acceptance:** Journeys 7 and 13 keep prior destination; slots update correctly.

---

## 2. Wire Rahhal Constitution into `planTurn` (P0)

Call `validatePrinciples` (or policy helpers) on enrichment snapshots before final reply. On violation: recover, do not emit empty/harsh failure.

**Acceptance:** Constitution unit principles visible in live chat diagnostics; rejection/empty paths attempt recovery checklist.

---

## 3. Merge Sprint 84 Itinerary Refinement to main (P1)

Close the pipeline hole between Package Builder and Decision Engine.

**Acceptance:** Flag `ai.itinerary_refinement` available on main; verify script green.

---

## 4. Make Package Builder skip visible (P1)

If flight/hotel pools incomplete, either (a) ensure tools always supply both before packaging, or (b) narrate why packages were skipped and still offer alternatives.

**Acceptance:** No silent `dynamicPackages: null` on booking-ready family/business turns with search results.

---

## 5. Run Price Intelligence before Decision (or feed DE) (P1)

Align runtime with product diagram so timing advice influences selection.

**Acceptance:** Decision notes reference timing recommendation when flag ON.

---

## 6. Destination change replaces, does not only append (P1)

When user locks a new single destination, clear or demote the previous primary.

**Acceptance:** Journey 5 → `destinations` does not keep Paris as active peer without multi-city intent.

---

## 7. Rejection recovery pack (P1)

On “No / not this / changed my mind”: keep constraints, emit ≥2 ranked alternatives with explanations.

**Acceptance:** Journey 8 shows alternatives; no full memory wipe.

---

## 8. Infeasibility negotiator (P1)

When budget/time/mission conflict: explain constraints + closest achievable options (Constitution P1/P5).

**Acceptance:** Journey 7/10 never invent destination tokens; always explain tradeoffs.

---

## 9. Structured unavailable-flight / unavailable-hotel handlers (P1)

Map utterances to recovery attempts (airline alts, nearby airports, hotel class/area alts).

**Acceptance:** Journeys 11–12 show explicit alternative search behavior.

---

## 10. Live-provider Alpha dry-run checklist (P0 for live)

Secrets, flags, empty-result drills, CSP, rate limits — ops-owned.

**Acceptance:** Documented live run with screenshots + incident notes.

---

## 11. Hotel class / amenity preference slots (P2)

Persist 3★→5★ / villa / private pool as first-class constraints into hotel search + packages.

**Acceptance:** Journey 9 reply cites new class.

---

## 12. Activities in family packages (P2)

Pass attractions tool results into Package Builder activities input on family purpose.

**Acceptance:** Journey 1 package/notes mention activities.

---

## 13. Traveler-facing explanation schema (P2)

Always include Why / Benefits / Tradeoffs / Confidence in Conversation Brain facts when a recommendation exists.

**Acceptance:** Spot-check replies match Constitution P3.

---

## 14. Durable learning profile (optional store) (P2)

Beyond in-memory PreferenceStore for Alpha cohort users who opt in.

**Acceptance:** Preference survives refresh for same user id.

---

## 15. Cross-session resume token (P2)

“Continue later” creates a resumable trip draft id.

**Acceptance:** Journey 15 works after new conversation id with draft reference.

---

## 16. Unify decision explainability path (P2)

Prefer Sprint 79 autonomous decision meta on all planning turns; reduce legacy decision divergence.

**Acceptance:** Single explanation shape in providerMeta.

---

## 17. Alpha Playwright smoke for 5 core journeys (P2)

Family, business, honeymoon, budget, destination-edit — UI level.

**Acceptance:** e2e job green on preview.

---

## 18. Constitution telemetry dashboard (P2)

Emit `constitution.validation.*` events from live path into ops metrics.

**Acceptance:** Ops dashboard shows pass/fail counts.

---

## 19. Doc sync (SYSTEM_STATUS, KNOWN_LIMITATIONS) (P3)

Reflect S74–S87 wiring and Alpha WARNING status.

**Acceptance:** Status docs match `ALPHA_READINESS_REPORT.md`.

---

## 20. Generative dialogue optional path (P3)

Only if product commits to LLM-backed Conversation Brain for Alpha cohort — not required for mock Alpha WARNING exit.

**Acceptance:** Flag-gated; mock path unchanged.

---

## Suggested Sprint 89 slice

1. Extraction safety (Improvement 1)  
2. Constitution wire-up (2)  
3. Package skip visibility / pool guarantees (4)  
4. Destination replace semantics (6)  
5. Rejection + infeasibility recovery (7–8)  

Defer live payments and generative LLM until after mock Alpha cohort feedback.
