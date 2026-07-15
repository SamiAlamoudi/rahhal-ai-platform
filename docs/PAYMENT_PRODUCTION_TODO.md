# Moyasar production payments — frozen TODO

**Status:** Feature-complete in code. **Frozen for production enablement** pending business verification.

Do **not** remove or rewrite the existing checkout/payment implementation
(`src/lib/payment/**`, checkout pages, `supabase/functions/moyasar-*`).
Keep `VITE_PAYMENT_PROVIDER=mock` (or unset) until the items below are done.

This document is the **source of truth** for future payment activation. Planning
updates below are documentation only — they must **not** trigger production
payment-method enablement or alternate PSP cutovers while frozen.

## Remaining to enable production payments

### 1. Business verification
- [ ] Complete Moyasar merchant / business verification for the Rahhal legal entity
- [ ] Confirm settlement currency, payout bank details, and account approval in the Moyasar dashboard
- [ ] Confirm approved payment methods for Saudi Arabia (cards / Apple Pay / etc. as contracted)

### 2. Live API keys
- [ ] Obtain Moyasar **live** secret key (`sk_live_...`) — never place it in `VITE_*`
- [ ] Set Edge Function secrets on the **production** Supabase project:
  - `MOYASAR_SECRET_KEY=sk_live_...`
  - `MOYASAR_WEBHOOK_SECRET=<production shared secret>`
  - Optional: `MOYASAR_BASE_URL`, `MOYASAR_INVOICE_CALLBACK_URL`
- [ ] Set SPA production env: `VITE_PAYMENT_PROVIDER=moyasar` plus `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- [ ] Redeploy Edge Functions: `moyasar-payment`, `moyasar-webhook`

### 3. Live webhook
- [ ] Register the production webhook URL in Moyasar pointing at  
  `https://<prod-project>.supabase.co/functions/v1/moyasar-webhook`
- [ ] Verify auth via `X-Moyasar-Signature` / `x-rahhal-webhook-secret` / `?webhook_secret=` matching `MOYASAR_WEBHOOK_SECRET`
- [ ] Confirm webhook delivery updates `payment_sessions` and `orders` (idempotent paid path)
- [ ] Confirm SPA return URL still lands on `/checkout/return?orderId=...`

### 4. Final sandbox verification
- [ ] With **test** keys still active, run one end-to-end hosted invoice payment in the app
- [ ] Confirm redirect to `*.moyasar.com`, return to `/checkout/return`, then success/failure route
- [ ] In Supabase, verify `payment_sessions.status` and `orders.status` reflect the paid (or failed) outcome
- [ ] Only after sandbox pass: switch secrets to live keys and repeat a controlled live smoke test

## Explicit non-goals while frozen
- Do not implement alternate PSPs (HyperPay / Stripe / Checkout.com) for production cutover
- Do not activate Moyasar, Stripe, or any live payment provider in production
- Do not delete mock payment provider — keep it for local/dev without keys
- Do not change completed Moyasar Edge Function contracts unless Moyasar API requires it after verification
- Do not enable any production payment method until business verification and live credentials are complete

---

## Future payment methods roadmap (planning only)

Support planning for the methods below. **No implementation in this phase.**
Keep `VITE_PAYMENT_PROVIDER=mock` until verification and live credentials are complete.

### Methods to plan for
- Credit and debit cards
- Apple Pay
- Google Pay
- Mada
- STC Pay
- Bank transfer
- Tabby
- Tamara
- PayPal
- Other regional and international payment methods as merchant eligibility allows

### Providers to keep supported through the abstraction layer
- Stripe
- Moyasar
- Apple Pay / Google Pay / Mada / STC Pay (as provider-capable method rails)
- Bank Transfer
- Tabby / Tamara
- PayPal
- Other providers added behind the same payment provider factory — never hardcode checkout to one PSP

### Provider-agnostic adapter architecture (required)

Future checkout must keep a **provider-agnostic adapter layer** so methods can be
enabled by:

- Country
- Currency
- Merchant eligibility
- Provider availability
- Booking amount / risk rules

Checkout UI and orchestration must not hardcode a single PSP’s method list.
Adding or enabling a method should be configuration + adapter capability, not a
checkout rewrite.

Suggested direction (future work only):

1. Keep the existing payment provider interface / factory pattern.
2. Expose a capability catalog per provider (supported methods, countries, currencies).
3. Resolve visible methods at runtime from country + currency + amount + eligibility.
4. Route capture/authorize/webhook flows through the selected adapter without changing booking/order domain models.

### Method-specific constraints

**Buy now, pay later (BNPL)**
- Tabby and Tamara are BNPL methods and require **separate merchant approval**.
- Do not surface them until each BNPL partner contract and integration keys are approved.

**Wallet / card rails**
- Apple Pay, Google Pay, Mada, STC Pay, and card support depend on the selected
  payment provider and merchant verification status.
- Availability can differ by country/currency even when the provider account is live.

**Bank transfer**
- Requires reconciliation, payment reference tracking, pending status, expiry,
  and either admin confirmation or automated bank integration.
- Pending transfers must not mark bookings as paid until cleared/confirmed.

**Dynamic method presentation**
- Payment methods must be shown dynamically based on country, currency, booking
  amount, and provider eligibility.
- Hidden/disabled methods must fail closed (not offer capture paths).

### Activation rule

No production payment method should be enabled until:

1. Business verification is complete
2. Live credentials are installed as Edge secrets (never `VITE_*` secrets)
3. Sandbox end-to-end verification has passed
4. Method-specific merchant approvals (e.g. Tabby/Tamara, Apple Pay) are confirmed
