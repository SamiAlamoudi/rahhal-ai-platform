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
| Voice conversation foundation | `ui.voice_conversation` (+ `voice.*`) | OFF | OFF |
| ChatGPT UX | `ui.chatgpt_experience` | OFF | OFF |

Notes:

- Dual master flags (`ai.live_providers` + `providers.live_master`) are intentional; both must stay OFF for prod V1 unless ops explicitly enables live.
- Provider Runtime (Sprint 71) respects the same provider flags and falls back to mock when secrets/flags are missing.
- Sprint 18/19 optional React UI wrappers were removed in Sprint 73.5; library flags remain for `src/lib/voiceConversation` / `src/lib/brain`.

Audit: `auditFeatureFlags()`. Critical if any must-be-off flag is enabled.
