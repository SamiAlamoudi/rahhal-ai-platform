# FINAL Technical Debt Register

**As of:** Architecture Freeze Audit 2026-07-24  
**Supersedes for freeze decisions:** root `TECHNICAL_DEBT.md` where conflicts exist (that file is partially stale—e.g. H5 RapidAPI `VITE_*` is **paid down**).  
**Companion:** `FINAL_ARCHITECTURE_AUDIT.md`, `FINAL_PRODUCTION_CHECKLIST.md`

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Open** | Still present; safe for feature work unless noted |
| **Paid** | Resolved by Recovery / Production Authority (#197–#204) |
| **Accepted** | Known constraint; not scheduled as a freeze blocker |

---

## Paid down (do not re-open as blockers)

| ID | Item | Resolution |
|----|------|------------|
| P1 | Circular dependencies | `arch:circular` = 0; CI-gated |
| P2 | Client `VITE_OPENAI_*` / `VITE_RAPIDAPI_*` / `VITE_BOOKING_API_KEY` | Hard-fail + Edge proxies |
| P3 | Weak Edge CORS (`*`) without allowlist controls | Shared allowlist + per-target overrides; staging/prod fail-closed when empty |
| P4 | Monolithic `planTurn` body | Extracted to typed stage modules + `runPlanTurn` |
| P5 | Default chat factory pulling quarantined providers | Quarantined module; factory throws |
| P6 | Dual conversation SoT on routing | Recovery Phase 1: `/chat` only; legacy redirect |
| P7 | OpenAI / Booking secrets in SPA bundle | Server-only; SPA uses proxy URLs + anon |

---

## Open debt (ranked)

### High (schedule after features start, or before live providers go ON)

| ID | Debt | Evidence | Suggested next step |
|----|------|----------|---------------------|
| H1 | Unused `src/domains/**` façades | Zero product importers; 45 files | Delete or finish migration; stop documenting as active DDD layer until used |
| H2 | Quarantined UI still in `src/ui/**` | Test-only importers; Production\* screens OFF | Move under `archive/` or delete when tests migrated |
| H3 | Orphan `TravelConversation.tsx` | Not lazy-routed; redirect only | Delete page file; keep redirect |
| H4 | Partial Chat experience quarantine | `ChatPage`/`MessageBubble` static-import feature/theme leaves | Dynamic-import remaining leaves behind flags |
| H5 | Dual provider façades (`aggregation` vs `liveProviders`) | Both wrap `integrations/providers` | Prefer one agent-facing registry for new work |
| H6 | Admin auth is SPA-only | `VITE_ADMIN_USER_IDS` / `app_metadata` | Server RLS/claims for true admin |
| H7 | Edge proxies + anon JWT | Legitimate SPA invoke pattern; quota risk if live keys set | Rate limits / abuse controls when live |
| H8 | Doc drift vs Authority | `docs/EXPERIENCE_SPRINT2.md`, `docs/SECURITY.md`, old `TECHNICAL_DEBT.md` H5 | Docs scrub sprint (non-code) |

### Medium

| ID | Debt | Notes |
|----|------|-------|
| M1 | `runToolsForPlan` still inside factory | Extract behind existing `PlanTurnDeps` signature |
| M2 | Dual docs trees (`docs/` vs `documentation/`) | Fold Amadeus/Multi-provider guides into `docs/` |
| M3 | Dual payment naming (`lib/payment` vs quarantined `lib/payments`) | Keep product on `payment`; delete quarantine when unused |
| M4 | Dual voice stacks historically | Production = `chat/voice`; confirm Sprint 18 path stays OFF |
| M5 | Fat barrels / sprint verify script sprawl | Slim public exports; trim obsolete `*:verify` scripts over time |
| M6 | Chat bundle size | Route lazy; further internal splits optional |
| M7 | Playwright Chromium-only | Multi-browser later |
| M8 | CORS allowlist must be set in real staging/prod | Empty + non-permissive → `Allow-Origin: null` |

### Low

| ID | Debt | Notes |
|----|------|-------|
| L1 | Mixed page naming (`*Page` vs bare) | Cosmetic |
| L2 | Hooks split (`src/hooks` vs lib hooks) | Re-export later |
| L3 | Deprecated agent aliases still exported | Rename call sites when touching those modules |
| L4 | Duplicate allowlist logic (Deno / Vercel / TS helper) | Keep semantics in lockstep |
| L5 | Rental live path unfinished | Scaffold only; enable in dedicated sprint |

---

## Explicitly out of scope for “debt cleanup before features”

- Rewriting Decision Engine / Planning Draft / Conversation Brain / Smart Clarification  
- Redesigning OpenAI or Booking proxies  
- New traveler-facing product features  

---

## Recommendation

Feature teams may proceed. Prefer **not** expanding `src/domains/**` or `src/ui/**` until H1–H3 are resolved. Treat `.env.example` + `FINAL_*` reports + CI gates as source of truth over sprint-era docs until H8 is scrubbed.
