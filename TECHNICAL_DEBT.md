# Technical Debt Register

Ranked after architecture DDD pass (`arch:circular` = 0). Behavior unchanged.

## Critical

| ID | Debt | Notes |
|----|------|-------|
| C1 | Coupons were client-mutable (mitigated in RC) | Migration applied; verify on all envs |
| C2 | Edge provider proxies accept anon JWT + open CORS | Quota abuse if live keys present |

## High

| ID | Debt | Notes |
|----|------|-------|
| H1 | Dual conversation SoTs (utils legacy vs chat/agent/brain) | Documented; converge via domains/conversation |
| H2 | Dual voice stacks | Production = `chat/voice`; Sprint 18 flagged OFF |
| H3 | Dual payment packages | Façade unified; implementations still split |
| H4 | Dual execution engines | Naming collision risk |
| H5 | RapidAPI keys still readable via `VITE_*` | Warn on hardened targets; needs server proxy |
| H6 | Admin authorization is SPA-only | `VITE_ADMIN_USER_IDS` / `app_metadata` |
| H7 | ChatPage JS chunk ~569 kB | Lazy route helps; needs internal split |
| H8 | UI still deep-imports `lib/` | Domains exist; migration incomplete |

## Medium

| ID | Debt | Notes |
|----|------|-------|
| M1 | `utils/` misnamed domain engine layer | Map to `domains/core` physically later |
| M2 | Fat barrels (`brain/index`, `integrations/index`) | Slim public vs internal |
| M3 | Orchestrator sprawl (Sprint 27 vs 43) | Flag-isolated; consolidate docs |
| M4 | Ineffective dynamic imports (brain integration/orchestrator) | Static edges remain elsewhere |
| M5 | Map iframe vs CSP `frame-src` | UX/CSP alignment |
| M6 | Playwright Chromium-only | Multi-browser follow-up |
| M7 | Preview host publish manual | See PREVIEW_DEPLOYMENT.md |

## Low

| ID | Debt | Notes |
|----|------|-------|
| L1 | Mixed page naming (`*Page` vs bare) | Cosmetic |
| L2 | Hooks split (`src/hooks` vs `lib/hooks`) | Re-export later |
| L3 | Dual docs folders (`docs/` vs `documentation/`) | Fold into `docs/` |
| L4 | Deprecated agent aliases still exported | Rename call sites |
| L5 | `rahhalVoice` naming vs speech modules | Rename when safe |

## Paid down in this pass

- All madge circular dependencies (was 15 → **0**)
- Leaf types for session / search / brain integration
- Domain façades + ownership READMEs
- Architecture documentation suite
- `npm run arch:circular` gate
