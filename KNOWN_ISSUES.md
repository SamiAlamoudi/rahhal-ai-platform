# Known Issues — v1.0.1

Honest inventory of residual limitations. Carry-forward from `v1.0.0` / RC1 unless noted.

### Resolved in v1.0.1

- Missing `npm run providers:check` script and CI Providers check step (restored via PR #56; packaged in this patch).

### Resolved post-v1.0.1 (RC verification follow-up)

- Vite **dev** CSP `script-src 'self'` blocked React Refresh preamble (blank SPA). Dev middleware now allows `'unsafe-inline'` + local HMR websockets; production/preview CSP remains strict.
- `TravelConversation` crashed on first message when `msgIdRef` was read inside a `useState` initializer before declaration (TDZ).
- Vitest inherited developer `.env.local` adapter flags and flaked provider default/auto-enable suites; test config now uses `envDir: false` with an explicit mock-safe env.

## Major

1. **Browser E2E coverage is Chromium-only MVP**  
   Playwright covers the mock booking funnel (`npm run test:playwright` / CI `e2e` job). Multi-browser matrix and staging-host smoke remain follow-ups; Vitest `test:e2e` is still the library journey suite (not a browser harness).

2. **Staging host probes are dual-track**  
   Automated suite covers `checkLiveness` / `checkReadiness` / `checkHealth` library contracts. Deployed Edge `ops-health` and static `/health.json` still require a staging deploy checklist pass.

## Minor

1. **Live providers remain opt-in**  
   By design for RC1. Enabling any live provider requires Edge secrets + explicit flags and is out of RC1 scope.

2. **Mock payment only**  
   Moyasar/live card rails are intentionally blocked for staging/production env validation until a later payment production phase.

3. **Voice media APIs are mocked in CI**  
   Microphone permission denied / interrupt / reconnect paths are covered with mock STT/TTS; real-device variation is not CI-gated.

## Resolved for RC1 (do not reopen without evidence)

- Secret-hygiene false positives from docs/allowlists (addressed in Phase X via `scripts/secret-hygiene-scan.sh`)
- Mock payment + live-provider default-OFF enforcement in env validation and readiness probes
