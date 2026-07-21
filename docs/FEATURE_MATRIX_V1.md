# Feature Matrix (V1)

| Feature | Flag | Default | Prod V1 |
|---------|------|---------|---------|
| Booking Execution | `ai.booking_execution` | ON | ON |
| Trip Management | `ai.trip_management` | ON | ON |
| Payments (mock) | `ai.payments` | ON | ON (mock only) |
| Live providers master | `ai.live_providers` / `providers.live_master` | OFF | OFF |
| Amadeus / Booking / Duffel | `provider.*` | OFF | OFF |
| Live payments | `payments.live` | OFF | OFF |
| Brain debug | `brain.debug` | OFF | OFF |
| ChatGPT UX | `ui.chatgpt_experience` | OFF | OFF |

Audit: `auditFeatureFlags()`. Critical if any must-be-off flag is enabled.
