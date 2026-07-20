# Sprint 57 — Booking Execution Engine

Production booking lifecycle on top of Booking Intelligence + Live Providers.

## Module

`src/lib/agent/bookingExecution/`

| Piece | Role |
| --- | --- |
| Lifecycle | draft → pending → payment_required → confirmed → ticketed / cancelled / failed / expired |
| Orchestrator | Independent per-domain booking (flights, hotels, activities, transfers, cars, insurance) |
| Transaction Manager | retries, rollback, idempotency, timeouts, partial failure recovery |
| Reservation Manager | tokens, provider refs, expiration, refresh |
| Sessions | persist / resume / restart recovery |
| Unified Booking | provider, confirmation, PNR, reservation, status, travelers, pricing, taxes, tickets, documents |
| Events | BookingCreated / Pending / Confirmed / Failed / Cancelled / Expired / Completed |
| Audit | timestamps, provider, latency, errors, status history |

## Feature flags

| Flag | Default |
| --- | --- |
| `ai.booking_execution` | ON |
| `ai.transaction_manager` | ON |
| `ai.booking_resume` | ON |

Execution still requires booking readiness + an explicit confirm/book cue so Conversation Brain remains the only traveler-facing author.

## Tests

`src/lib/__tests__/bookingExecution.sprint57.test.ts` — mocked providers only, no network.
