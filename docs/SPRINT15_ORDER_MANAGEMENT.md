# Sprint 15 — Order Management Engine + Payment Preparation

Production-ready Order domain for Rahhal, linked to confirmed bookings, with a provider-independent payment preparation layer (mock only).

## Architecture

```
BookingSession (source of truth)
        │
        ▼
Booking Record / Confirmation (projections)
        │
        ▼
Order (references bookingSessionId)
        │
        ▼
Payment Session (references orderId)
```

- **No duplicated state** — Orders store a pointer to `BookingSession`; passenger/itinerary data is projected at create time for checkout.
- **No supplier coupling** — Payment gateways are ports; live providers remain off (`payments.live` stays false).
- Existing checkout funnel (`/checkout/*`) is unchanged; Sprint 15 adds `/checkout/order/:orderId`.

## Order entity

Created via `createOrderFromBooking` after confirmation.

| Field | Source |
|-------|--------|
| Order ID | `RahhalOrder.id` |
| Booking Reference | `order.bookingNumber` |
| Customer ID | `order.userId` |
| Passengers | Booking session passengers → travelers |
| Itinerary | Flight metadata projection |
| Total / Currency | Taxed cart |
| Order Status | Mapped managed status |
| Payment Status | Mapped from order (+ session when present) |
| Created / Updated | Order timestamps |

### Managed order statuses

Draft · Awaiting Payment · Paid · Payment Failed · Confirmed · Cancelled · Refunded (future)

## Checkout review

Route: `/checkout/order/:orderId` (`OrderCheckoutReviewPage`)

Shows: flight summary, passengers, fare breakdown (base / taxes / fees / total), booking conditions, cancellation policy placeholder, AI Concierge summary, order timeline, pay CTA.

Flag: `ui.checkout_review` (depends on `ui.order_management`).

## Payment preparation

`src/lib/orderManagement/paymentGateways/`

| Gateway | Status |
|---------|--------|
| Mock | Active (default) |
| Stripe | Stub |
| HyperPay | Stub |
| Moyasar | Stub |
| Tabby | Stub |
| Tamara | Stub |

## Payment session

`createPaymentSession` / `resumePaymentSession` / `expirePaymentSession` / `retryPaymentSession`

- Active session per order prevents duplicate attempts (resume by default; `rejectDuplicate` throws `DuplicatePaymentAttemptError`).
- `markMockPaymentPaid` for prep-layer tests only.

Flag: `ui.payment_preparation`.

## Timeline

`buildOrderTimeline` extends the booking timeline:

Booking Created → Booking Confirmed → Order Created → Awaiting Payment → Paid → Ticket Pending → Completed

Rendered via reusable `BookingTimeline`.

## AI Concierge

Intents (above confirmation / history):

- How much will I pay?
- Is my order ready?
- Show my checkout.
- What is my payment status?

## Feature flags

| Product alias | Registry ID | Depends on |
|---------------|-------------|------------|
| `order_management` | `ui.order_management` | `ui.booking_confirmation` |
| `checkout_review` | `ui.checkout_review` | `ui.order_management` |
| `payment_preparation` | `ui.payment_preparation` | `ui.order_management` |

## Library entry

```ts
import {
  createOrderFromBooking,
  createPaymentSessionForOrder,
  buildCheckoutReviewModel,
  buildOrderTimeline,
  buildOrderConciergeReply,
} from '@/lib/orderManagement'
```

## Tests

`src/lib/__tests__/orderManagement.sprint15.test.ts` — lifecycle, checkout model, payment sessions, gateways, concierge intents.

## Non-goals

- Live Stripe / HyperPay / Moyasar / Tabby / Tamara charges
- Ticket issuance (timeline reserved)
- Breaking Sprints 9–14 flows
