# Known Issues — v1.0.0-rc1

Honest inventory for the RC1 candidate. None of the items below are Blocker/Critical for library RC1 exit criteria.

## Accepted for RC1

1. **Library E2E vs browser E2E**  
   Core journey is validated via Vitest orchestrator/service composition (`rc1.journey.e2e.test.ts`), not Playwright/Cypress against a real browser. Staging manual smoke remains required on a live host.

2. **Live providers default OFF**  
   Amadeus / Booking.com / Google Maps / OpenWeather require explicit flags + server secrets. Mock fallback is the staging default.

3. **Payments remain mock-only**  
   Moyasar live checkout is frozen (`docs/PAYMENT_PRODUCTION_TODO.md`). `VITE_PAYMENT_PROVIDER=mock` is mandatory for RC1.

4. **Supabase-backed auth/chat persistence in CI**  
   Auth and chat persistence paths are exercised with mocks in automated tests. Real staging Supabase verification is part of the manual smoke checklist.

5. **Microphone / Web Speech APIs**  
   Voice suites use mock STT/TTS and stubbed permission APIs. Real device permission UX should be spot-checked on staging browsers.

6. **Ops Edge Function `ops-health`**  
   Automated tests assert function source + library probe semantics. Deployed Edge readiness must be confirmed on the staging project.

## Non-goals deferred past RC1

- Production `v1.0.0` tag/release
- Enabling live payments
- Default-on live travel providers
- UI redesign / project rename
- New product features (feature freeze)

## How to add issues

Append rows to `RELEASE_BLOCKERS.md` with severity. Keep this file factual — do not mark unverified claims as fixed.
