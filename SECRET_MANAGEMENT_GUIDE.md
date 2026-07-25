# Secret Management Guide

## Ownership

| Layer | Owner | Responsibility |
|-------|--------|----------------|
| SecretRegistry | Platform security | Typed definitions, aliases, duplicate detection |
| EnvironmentSecretProvider | Platform security | Sole runtime env reader |
| SecretManager | Platform security | Resolution, authz, audit, rotation hooks |
| Provider modules | Provider owners | Declare providerId; call `readManagedEnv` / `readManagedSecret` |

## Required vs optional

- **Critical (production):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — missing → hard fail in production startup validation.
- **Optional integrations:** OpenAI, Amadeus, Duffel, Booking, Maps, Weather, Currency, Email, Notifications, Payment — missing → provider disabled gracefully; conversation continues.

## Environment naming

- Server secrets: `AMADEUS_API_KEY`, `OPENAI_API_KEY`, `DUFFEL_API_TOKEN`, … (never `VITE_*`)
- Client-safe / public: `VITE_SUPABASE_*`, feature toggles, proxy URLs
- Ephemeral client (discouraged): legacy `VITE_*` API keys — prefer Edge proxies

## Local development

1. Copy `.env.example` → `.env.local`
2. Set only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for auth
3. Leave provider secrets empty (mock adapters)
4. Do **not** copy a broad `.env.local` into test runs (provider tests expect mocks)

## Staging

- Inject secrets via host env / Vercel / Supabase Edge secrets
- Keep `VITE_PAYMENT_PROVIDER=mock` and live provider flags OFF unless intentionally testing
- Run `npm run security:gate` before promote

## Production

- Critical Supabase client config required
- Provider secrets only on server/Edge
- `security.secret_manager` may be enabled after validation; default remains OFF
- On critical validation failure, abort boot safely (`validateSecretsAtStartup`)

## Incident response

1. Rotate the compromised credential at the provider
2. Call SecretManager `invalidateCache()` / `refresh()` after redeploy
3. Scan logs (already sanitized) and revoke sessions if auth tokens leaked
4. Re-run `npm run security:scan` on the repository

## Module API

```ts
import {
  getSecretManager,
  readManagedEnv,
  readManagedSecret,
  resolveProviderCredentials,
  sanitizeForLogs,
} from '@/lib/security'
```

Never call `process.env` / `import.meta.env` from provider modules.
