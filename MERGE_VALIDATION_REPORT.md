# Merge Validation Report — Post-Integration

**Branch:** `main` @ `6a405ad`  
**Scope:** Full repository validation after final merge (#283)

## Quality gates

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:run` | PASS — **2883** tests / **251** files |
| `npm run build` | PASS — ChatPage **139.28 kB** |
| `npm run preview` (local) | PASS — HTTP 200, assets 200 |
| `npm run arch:circular` | PASS — no circular deps under `src/` |
| `npm run security:gate` | PASS |
| `npm audit --audit-level=high` | PASS — 0 |
| `npm run providers:check` | PASS |
| `npm run rc2:review` | PASS |

## Structural hygiene

| Check | Result |
|-------|--------|
| Duplicate service packages (SecretManager / Observability / Load / Audit / RC1 / Soak / RC2) | PASS — one each under `src/lib/` |
| Case-duplicate `src/lib` directories | PASS — none |
| Broken imports (typecheck + tests) | PASS |
| Circular dependencies | PASS |
| Dead critical feature flags default ON | PASS — all critical defaults OFF |

## Subsystem operational checks (flags / defaults)

| Area | Status | Notes |
|------|--------|-------|
| Feature flags | PASS | Critical harness/live/integration flags OFF |
| Recovery | PASS | Load resilience + disruption modules present; flags OFF |
| Security | PASS | SecretManager present; `security.secret_manager` OFF |
| Observability | PASS | Platform present; `observability.platform` OFF |
| Providers | PASS | Mock defaults; live flags OFF |
| Journey Engine | PASS | Integration journey module present; flag OFF |
| Action Engine | PASS | Present; flag OFF |
| Memory / Conversation | PASS | Unit suites green; product defaults unchanged |

## Bundle / performance

| Metric | Value |
|--------|------:|
| ChatPage | 139.28 kB |
| Growth vs pre-merge tip | none |

## Runtime / host verification

| Surface | Result |
|---------|--------|
| Local preview (`127.0.0.1:4173`) | Assets + HTML 200 |
| Local dev (`127.0.0.1:5173`) | Server 200; **React mount fails** with placeholder Supabase (`example.supabase.co`) — env limitation, not merge regression |
| Vercel Preview deploy (explicit, non-prod) | READY — `https://workspace-72htre4o9-rahhal-ai-project.vercel.app` (SSO-protected) |
| Hosted public app | `https://rahhal-ai-platform.vercel.app` Arabic RTL login boots; form works; demo credentials not present in hosted DB |

## Verdict

**Integration validation: PASS** for repository merge integrity and automated gates.  
Runtime login/conversation on **local** agent VM blocked only by missing real Supabase credentials / Docker (see `KNOWN_ISSUES.md`).
