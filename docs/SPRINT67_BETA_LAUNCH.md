# Sprint 67 — Beta Launch Environment & Live Provider Activation

Configure and validate Rahhal V1 for a real beta environment. **No architecture rewrite.**

## Module

`src/lib/ops/beta/`

| API | Purpose |
|-----|---------|
| `getBetaEnvironmentProfile()` | staging / beta / production profiles |
| `buildBetaProviderMatrix()` | Amadeus / Booking.com / Duffel / mock / future |
| `configureBetaLiveProviders()` | Opt-in feature-flag activation when secrets exist |
| `buildBetaPaymentMatrix()` / `createBetaPaymentRegistry()` | Mock + Stripe + HyperPay + Apple Pay (sandbox/future) |
| `createProductionNotificationLayer()` | Email / WhatsApp / Push / SMS + retry + delivery tracking |
| `enableBetaObservability()` | Structured logs, correlation, domain metrics |
| `runBetaConfigDiagnostics()` | Env / secrets / flags / payments consistency |
| `runBetaSecurityValidation()` | Secret exposure, rate limits, auth, audit |
| `runBetaSmokeTests()` | Search → book → trip → docs → cancel → refresh |
| `generateBetaReadinessReport()` / `runBetaLaunchValidation()` | Beta readiness diagnostics |

## Safe beta defaults

- `VITE_PAYMENT_PROVIDER=mock`
- Live providers OFF unless flags + server secrets
- `VITE_PROVIDER_MOCK_FALLBACK=true`
- No provider secrets in `VITE_*`

## Verify

```bash
npm run beta:verify
# or
npm run test:run -- src/lib/__tests__/betaLaunch.sprint67.test.ts
```
