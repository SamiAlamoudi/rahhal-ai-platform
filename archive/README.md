# Archive — Recovery

**Sprint 80 P1-1 (2026-07-31):** orphan UI/hooks under `archive/src/**` were **hard-deleted**
(brain/voice debug chrome + unused conversation/voice hooks). They were never on the
product import graph.

**Do not reintroduce parallel chat owners.** Canonical spine remains:

`/chat` → `LegacyChatPage` → `chatEngine` → `travelAgentService.planTurn`

## Quarantine status

See `archive/QUARANTINE.md` for modules still present under `src/` (flag-OFF / test harness)
versus packages removed in P1-1.
