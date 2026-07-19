# Sprint 34 — Payments & Checkout Platform

Production-ready payment and checkout platform for Rahhal AI. Sits **after** Sprint 33 `TravelExecutionEngine` and **before** final booking confirmation.

> **Naming note:** Existing hosted checkout lives at `src/lib/payment/` (Moyasar, CheckoutOrchestrator, Phase S FSM). Sprint 34 adds `src/lib/payments/` (plural) — a brain-linked platform with multi-provider sandbox adapters, intents, receipts, refunds, and conversation pay-now. It does **not** replace or duplicate the Moyasar stack.

## Non-goals (strict)

- Do not rewrite TravelExecutionEngine, UnifiedTravelPlanner, Conversation UI, Hotel/Flight providers, or `src/lib/payment` Moyasar checkout
- Do not duplicate planning / provider search / booking-session UI logic
- Do not change Sprint 1–33 behavior when `brain.payments_platform` is OFF
- Do not ship live Stripe / Adyen / Checkout.com / HyperPay credentials

## Architecture

```
TravelExecutionEngine (COMPLETED)
  → PaymentOrchestrator.startFromExecution
       ├─ PaymentIntentService (create intent + tax breakdown)
       ├─ Reserve inventory (temporary hold)
       ├─ PaymentProviderRegistry.chargeWithFailover
       │     └─ Stripe | Adyen | Checkout.com | HyperPay | Mock adapters
       ├─ Verify payment
       ├─ Confirm booking references
       ├─ PaymentReceipt + InvoiceGenerator
       ├─ PaymentEvents / PaymentAudit / PaymentMetrics
       └─ On failure → release hold + rollback (audit preserved)
```

| Module | Responsibility |
|--------|----------------|
| `PaymentOrchestrator` | End-to-end checkout workflow |
| `PaymentProviderRegistry` | Provider selection + failover (never hardcode at call sites) |
| `PaymentIntentService` | Intent creation + idempotency |
| `PaymentSession` | In-memory session store |
| `PaymentValidator` | Currency / method / state validation |
| `PaymentResult` | Aggregate success/failure payload |
| `PaymentReceipt` | Payment receipt |
| `InvoiceGenerator` | Booking invoice from platform session |
| `PaymentEvents` | Intent / paid / failed / refund / rollback events |
| `RefundEngine` | Full / partial / cancellation / failed-payment rollback |
| `PaymentAudit` / `PaymentMetrics` | Observability |
| `conversation/payNowPrompt` | “Would you like to pay now?” copy |

## Providers (abstraction only)

Sandbox adapters — same port, no embedded live SDKs:

- Stripe
- Adyen
- Checkout.com
- HyperPay
- MockPaymentProvider

## Payment methods

Apple Pay · Google Pay · Credit Cards · Mada · STC Pay (future-ready) · Bank transfer (abstraction)

## Currency & taxes

Currencies: **SAR, USD, EUR, GBP**

Breakdown: VAT · provider fees · service fees · coupon discounts (`RAHHAL10`, `RAHHAL15`, `WELCOME50`)

## Failure handling

If payment fails (declined / timeout / error):

1. Release temporary inventory hold
2. Optionally invoke `releaseExecutionHold` to cancel execution session
3. Preserve full audit trail (`ROLLED_BACK`)

## Conversation integration

When `brain.payments_platform` is ON, Conversation UI can present:

> I found the best itinerary.  
> The total is 5,320 SAR.  
> Would you like to pay now?

Implemented via `buildPayNowOffer` + `ResponseComposer` / `pay_now` command — **no duplicate planning**.

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `payments_platform` | `brain.payments_platform` | `brain.travel_execution_engine` |

## Modules

`src/lib/payments/`

## Tests

`src/lib/__tests__/paymentsPlatform.sprint34.test.ts`
