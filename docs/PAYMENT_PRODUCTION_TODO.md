# Moyasar production payments — frozen TODO

**Status:** Feature-complete in code. **Frozen for production enablement** pending business verification.

Do **not** remove or rewrite the existing checkout/payment implementation
(`src/lib/payment/**`, checkout pages, `supabase/functions/moyasar-*`).
Keep `VITE_PAYMENT_PROVIDER=mock` (or unset) until the items below are done.

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
- Do not delete mock payment provider — keep it for local/dev without keys
- Do not change completed Moyasar Edge Function contracts unless Moyasar API requires it after verification
