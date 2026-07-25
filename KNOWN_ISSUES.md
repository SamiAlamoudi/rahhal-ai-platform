# Known Issues — Post Merge Integration (2026-07-25)

Honest inventory after merging Production Readiness stack #277–#283 into `main`.

## Merge / integration

1. **PR #278 first landed on stacked base, not `main`**  
   Retarget via `gh pr edit --base` was denied. GitHub merge closed #278 into `cursor/production-security-secrets-7518`. Content was immediately merged into `main` with an explicit merge commit before continuing. Later PRs were retargeted with ManagePullRequest before merge.

2. **Parallel Integration Drafts #266–#276 remain open**  
   Intentionally not merged. Merging them without reconciliation risks conflicts/duplication with modules already on `main`.

## Runtime / environment

1. **Local agent VM cannot complete login without real Supabase**  
   `.env.local` uses placeholder `https://example.supabase.co`. `supabaseClient` initializes at import time; React may not mount. Docker / `supabase start` unavailable in this environment. Hosted app boot was verified separately.

2. **Demo credentials not present on hosted Supabase**  
   Login form on `https://rahhal-ai-platform.vercel.app` works, but arbitrary demo email/password returns invalid credentials (expected without seeded demo user).

3. **Vercel Preview deployments are SSO-protected**  
   Explicit Preview URL requires Vercel authentication; browser console shows Vercel SSO/FedCM noise, not app runtime faults.

4. **Vercel Production auto-deploy on `main`**  
   Merging to `main` triggered Vercel Production deployments via project settings. This phase did **not** run `vercel deploy --prod`. Ops should confirm whether Production auto-deploy on `main` is desired.

## Pre-existing (carry-forward)

1. **Playwright booking-funnel E2E** — demo-login → `/chat` timeout in CI (seen on #281/#282). Not introduced by merge commits.

2. **Live providers remain OFF by default** — intentional; Edge secrets required for pilots.

3. **Browser E2E is Chromium-only MVP** — multi-browser matrix still follow-up.

4. **`providers.amadeus.enabled` registry default true** — production helper still gates live URLs; keep `provider.amadeus` / live search flags OFF for safe defaults.

## Not issues

- ChatPage bundle unchanged at **139.28 kB**  
- `npm audit --audit-level=high` = 0  
- No circular dependencies  
- No duplicate SecretManager / Observability / Load / Audit / RC1 / Soak / RC2 packages  
