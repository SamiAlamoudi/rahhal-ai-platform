# Provider Secret Matrix

Each provider declares only the secrets it requires. Definitions are registered once in `SecretRegistry` (no duplicates).

| Provider ID | Keys (primary) | Aliases | Scope | Criticality |
|-------------|----------------|---------|-------|-------------|
| openai | `OPENAI_API_KEY` | — | server_only | optional |
| openai | `VITE_AGENT_OPENAI_API_KEY` | `VITE_OPENAI_API_KEY` | ephemeral_client | optional |
| amadeus | `AMADEUS_API_KEY` | `AMADEUS_CLIENT_ID` | server_only | optional |
| amadeus | `AMADEUS_API_SECRET` | `AMADEUS_CLIENT_SECRET` | server_only | optional |
| amadeus | `AMADEUS_BASE_URL` | — | public_config | optional |
| duffel | `DUFFEL_API_TOKEN` | — | server_only | optional |
| booking | `BOOKING_API_KEY` | `RAPIDAPI_KEY`, `BOOKING_RAPIDAPI_KEY` | server_only | optional |
| booking | `VITE_RAPIDAPI_KEY` | `VITE_BOOKING_API_KEY` | ephemeral_client | optional |
| google_maps | `GOOGLE_MAPS_API_KEY` | — | server_only | optional |
| weather | `OPENWEATHER_API_KEY` | — | server_only | optional |
| currency | `CURRENCY_API_KEY` | `EXCHANGE_RATE_API_KEY` | server_only | optional |
| email | `EMAIL_API_KEY` | `RESEND_API_KEY`, `SENDGRID_API_KEY` | server_only | optional |
| notifications | `NOTIFICATIONS_API_KEY` | `FCM_SERVER_KEY`, `ONESIGNAL_API_KEY` | server_only | optional |
| payment_future | `PAYMENT_SECRET_KEY` | `STRIPE_SECRET_KEY`, `HYPERPAY_SECRET` | server_only | optional |
| moyasar | `MOYASAR_SECRET_KEY` | — | server_only | optional (Edge only) |
| moyasar | `VITE_MOYASAR_PAYMENT_URL` | — | public_config | optional |
| supabase | `VITE_SUPABASE_URL` | — | client_safe | **critical** |
| supabase | `VITE_SUPABASE_ANON_KEY` | — | client_safe | **critical** |

## Isolation rules

- Amadeus **must not** read OpenAI secrets
- Maps **must not** read payment secrets
- Client modules **must not** embed server-only secret values in bundles
- Unauthorized access increments `unauthorizedAccessCount` (no secret values in metrics)
