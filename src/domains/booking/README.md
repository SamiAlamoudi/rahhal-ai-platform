# booking

## Responsibilities

Booking lifecycle: hold/book flows, confirmation, order management, and passenger data.

## Public API

- `src/lib/booking`
- `src/lib/bookingFlow`
- `src/lib/bookingConfirmation`
- `src/lib/orderManagement`
- `src/lib/passengers`

## Dependencies

May use `shared`, `core`, `infrastructure`, `flights`, `hotels`, `payments`. Must not import UI.

## Rules

- Compatibility shim only.
- No circular domain deps (e.g. payments must not import booking deeply in return).
