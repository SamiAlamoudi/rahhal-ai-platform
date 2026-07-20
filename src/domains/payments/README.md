# payments

## Responsibilities

Payment and checkout: hosted Moyasar/checkout stack (`lib/payment`) and Sprint 34 payments platform (`lib/payments`).

## Public API

- `src/lib/payment` — flat re-export
- `paymentsPlatform` namespace — `src/lib/payments` (namespaced: `PaymentOrchestrator`, `PaymentResult`, etc. collide with `lib/payment`)

## Dependencies

May use `shared`, `infrastructure`, `booking` (via public barrels). Must not import UI.

## Rules

- Two stacks coexist; do not merge implementations in this shim.
- Compatibility shim only.
