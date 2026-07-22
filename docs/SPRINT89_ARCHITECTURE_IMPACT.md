# Sprint 89 — Architecture Impact Report

**Rule check:** No new AI engines · No architecture redesign · Additive blocker fixes only.

---

## Summary

Sprint 89 touches **existing** layers only:

| Layer | Change | API impact |
| --- | --- | --- |
| Intent extraction | Guardrails + flags | Additive `ExtractionResult.flags` |
| Memory merge | Optional replace mode | Additive 3rd arg (default preserves union) |
| Package bridge | Fallback packages | Same function signature; never silent null |
| Agent constitution bridge | New thin adapter under `src/lib/agent/constitution` | Uses existing `src/core/constitution` |
| `travelAgentService.planTurn` | Calls constitution; enriches facts | Additive `meta.constitution` |
| Conversation Brain facts/renderer | Extra optional plan fields | Additive; older callers unaffected |
| Core Decision / Planner / Search engines | **Unchanged** | — |
| RahhalBrain | **Unchanged** | — |

---

## What was *not* changed

- No new core engines under `src/core/` (Constitution already existed from S87)
- No Decision Engine / Search Planner / PackageBuilder **core** public contract changes
- No database schema / RLS / Supabase migrations
- No feature-flag dependency graph redesign (`ai.constitution` already registered)
- No removal of mock-provider defaults

---

## Data flow (after)

```
user text
  → extractFromUserText (+ flags.replaceDestinations)
  → mergeRequirements (optional replace)
  → travel planner / search / enrich chain
  → package bridge (full | partial | explain)
  → decision / price / booking
  → buildTravelFacts (+ constitution recommendation facts)
  → Conversation Brain reply
  → applyConstitutionToTurn (validate reply + meta.constitution)
```

---

## Risk assessment

| Risk | Mitigation |
| --- | --- |
| Destination replace too aggressive | Only when explicit change/instead cues set the flag |
| Partial packages confuse Decision Engine | Low-confidence labeled `best_value`; notes explain partial mode |
| Constitution validation fails turns | Validation is diagnostic + fact enrichment; does not throw / block reply |
| Hotel class vs luxury budgetStyle clash | Star matcher ignores bare “luxury” |

---

## Rollback

Revert the Sprint 89 commit(s). Behavior returns to S87 main: Constitution unwired, package null-skip, prior extraction bugs. No migrations to undo.

---

## Follow-on architecture (optional, not in S89)

- Merge S84 itinerary refinement between packages and decision  
- Persist constitution violation metrics to ops dashboard  
- Provider-level recovery adapters for live empty inventory  
