# Sprint 87 — Risk Report

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Production accidentally enabled | High | Preview flag default OFF; production deploy-target hard block unchanged from Sprint 86 |
| Hardcoded consultant copy | Medium | Structured `destinationInsights` composed by ValueFirstPlanner + TravelReasoner; not fixed reply strings per utterance |
| Arabic reply length / UX bloat | Medium | ResponseGenerator soft-trim; Sprint 85 length assertion retained |
| Destination refine steals origin city | Medium | Refine requires cue / short bare city; `from`/`من` protects origin |
| Incremental update rebuilds whole plan | Medium | PlanRevision keeps `planId`; revise wording only when prior plan exists |
| Estimates read as live prices | Medium | Explicit “indicative / not a live quote” labels; no availability claims |
| Fallback regression | Low | Exception path still returns `fallback` → current planner |
| Stacked PR dependency on Sprint 86 | Low | Branch cut from `cursor/sprint86-brain-preview-71ec`; merge after #324 |

**Out of scope (intentionally not done):** production enable, UI redesign, Voice redesign, booking, payments, Sprint 88.
