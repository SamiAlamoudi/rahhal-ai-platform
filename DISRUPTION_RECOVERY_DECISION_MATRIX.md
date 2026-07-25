# Disruption Recovery — Decision Matrix (Sprint 10)

**Branch:** `cursor/live-disruption-recovery-7518`  
**Draft PR:** [#274](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/274)  
**Flag:** `ai.integration_disruption_recovery` (default OFF)

How Rahhal picks among recovery strategies after impact analysis.

---

## Strategy profiles

| Strategy | Cost bias | Time bias | Continuity | When it tends to win |
|---|---|---|---|---|
| **best** | medium | medium-high | high | Default balanced recommendation |
| **cheapest** | lowest | low | medium | Budget impact high; traveler cost-sensitive |
| **fastest** | high | highest | medium | Critical risk; large delay; time-critical meetings |
| **minimal_disruption** | medium-low | medium | highest | Protect hotel + meetings + same alliance |
| **premium** | highest | high | high | Overnight likely; high stress; comfort priority |

---

## Impact → action map

| Impact flag | Recovery actions |
|---|---|
| Timeline | Shift events; residual delay tracked |
| Hotel | Late arrival protect / relocate |
| Transfers | Recalculate airport→hotel window |
| Meetings | Reschedule or remote fallback |
| Activities | Compress / move same-day items |
| Budget | Surface extraCost on each plan; note budgetDelta |

---

## Risk escalation

| Risk | Delay cues (flights) | Planner bias |
|---|---|---|
| Low | &lt;60 min delay / gate change | Minimal or best |
| Medium | 60–179 min | Best |
| High | cancel / ≥180 min / hotel loss | Best or fastest |
| Critical | ≥360 min delay / severe missed connection | Fastest (+ premium if overnight) |

---

## Conversational ownership

| Ask | Owner when flag ON |
|---|---|
| Delay / cancel / missed connection / hotel cancel | **Disruption Recovery** (before companion) |
| Generic in-trip “what’s next” without disruption | Companion (if enabled) or soft what_now |
| Budget / price | Budget Pricing (Sprint 9) |
