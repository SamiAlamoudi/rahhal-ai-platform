# Known Issues — v1.0.0-rc1

Honest inventory of residual limitations for the release candidate.

## Major

1. **No browser E2E harness (Playwright/Cypress)**  
   Core journey and staging smoke are validated via Vitest library/integration tests with mocked Supabase auth and mock providers. Full browser automation against a deployed SPA is manual via `STAGING_SMOKE_TEST.md`.

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
