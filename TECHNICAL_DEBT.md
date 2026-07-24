# Technical Debt Register

Ranked after Recovery Phase 1 + engineering audit (`arch:circular` = 0). Behavior unchanged unless noted.

## Critical

| ID | Debt | Notes |
|----|------|-------|
| C1 | Coupons were client-mutable (mitigated in RC) | Migration applied; verify on all envs |
| C2 | Edge provider proxies accept anon JWT + open CORS | Quota abuse if live keys present |

## High

| ID | Debt | Notes |
|----|------|-------|
| H1 | Dual conversation SoTs (utils legacy `/search` vs chat/agent) | `/search` kept as form; chat SoT = planTurn |
| H2 | Dual voice stacks | Production = `chat/voice`; Sprint 18 flagged OFF |
| H3 | Dual payment packages | SoT = `lib/payment`; `lib/payments` quarantined |
| H4 | Dual execution engines | Naming collision risk |
| H5 | RapidAPI keys still readable via `VITE_*` | Warn on hardened targets; needs server proxy |
| H6 | Admin authorization is SPA-only | `VITE_ADMIN_USER_IDS` / `app_metadata` |
| H7 | ChatPage JS chunk ~569 kB | Lazy route helps; needs internal split |
| H8 | Static ChatPage import graph still pulls quarantined stacks | Thin static imports (Phase 2 follow-up) |

## Medium

| ID | Debt | Notes |
|----|------|-------|
| M1 | `utils/` still hosts domain-engine helpers | Keep; rename/move carefully later |
| M2 | Fat barrels (`brain/index`, `integrations/index`) | Slim public vs internal |
| M3 | Orchestrator sprawl (Sprint 27 vs 43) | Flag-isolated; consolidate docs |
| M4 | Ineffective dynamic imports (brain integration/orchestrator) | Static edges remain elsewhere |
| M5 | Map iframe vs CSP `frame-src` | UX/CSP alignment |
| M6 | Playwright Chromium-only | Multi-browser follow-up |
| M7 | Preview host publish manual | See PREVIEW_DEPLOYMENT.md |
| M8 | Near-duplicate `formatMoney` helpers across packages | Centralize behind `lib/payment/money.ts` when formats match |
| M9 | Decision Engine CITY_PACKS vs Planning Draft city priors | Shared catalog adapter (no behavior change) |

## Low

| ID | Debt | Notes |
|----|------|-------|
| L1 | Large `docs/SPRINT*.md` museum | Prefer `docs/history/` for new archival |
| L2 | Root ops markdown sprawl | Keep runbooks; archive point-in-time reports |
| L3 | ~~Dual `docs/` + `documentation/`~~ | **Resolved** — consolidated into `docs/` |
| L4 | Mixed page naming (`*Page` vs bare) | Cosmetic |
| L5 | Hooks split (`src/hooks` vs `lib/hooks`) | Re-export later |
| L6 | Deprecated agent aliases still exported | Rename call sites |

## Paid down in this pass

- All circular dependencies (was 15 → **0**; gated by `npm run arch:circular`)
- Leaf types for session / search / brain integration
- Unused `src/domains` façades removed (engineering audit)
- Legacy `TravelConversation` page + orphan summary components removed (redirect kept)
- Dead `formatReply` speech/ack helpers removed
- Dual `documentation/` folder folded into `docs/`
- Point-in-time root reports moved to `docs/history/`
- Architecture docs updated to `src/lib` as SoT
