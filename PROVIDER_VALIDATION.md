# Provider Validation — RC1 (Sprint 18)

| Provider | Adapter posture | Fallback | Status |
|----------|-----------------|----------|--------|
| LLM | mock / optional OpenAI | Conversation continues without live LLM | PASS |
| Maps | mock / google_maps proxy | Mock default; live OFF | PASS |
| Weather | mock / openweather | Mock default; secrets server-only | PASS |
| Flights | mock / amadeus\|duffel | `VITE_FLIGHT_PROVIDER=mock`; live flags OFF | PASS |
| Hotels | mock / booking | `VITE_HOTEL_ADAPTER=mock`; booking OFF | PASS |
| Payments | **mock** (required) | `getDefaultPaymentProviderType() === 'mock'` | PASS |
| Notifications | optional | Missing secrets disable gracefully | PASS |
| Mock providers | aggregation mocks | Mock fallback ON (`providers:check`) | PASS |

## Graceful fallback

All listed providers support degraded/mock paths without crashing conversation.

## Live providers

Live Amadeus / Duffel / Booking remain **flagged OFF** for RC1. Enabling requires Edge secrets + explicit flags (out of RC1 default scope).
