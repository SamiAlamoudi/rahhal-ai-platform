# Provider Matrix (V1)

| Provider | Domain | Search | Order | Secrets | Default |
|----------|--------|--------|-------|---------|---------|
| Mock | flights/hotels | Yes | Simulated | None | ON |
| Amadeus | flights | Real (opt-in) | Opt-in `AMADEUS_ORDER_LIVE` | Server-only | OFF |
| Booking.com | hotels | Real (opt-in) | Opt-in `BOOKING_ORDER_LIVE` | Server-only | OFF |
| Duffel | flights | Adapter present | Stub/limited | Server-only | OFF |

Failover: aggregation `priority_fallback` → mock. Circuit breakers + rate limiters in liveProviders / Phase W.

Never ship credentials in `VITE_*` (enforced by `validateEnvironment`).
