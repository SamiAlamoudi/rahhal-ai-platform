# Secret Manager — Architecture (Sprint 14)

**Branch:** `cursor/production-security-secrets-7518`  
**Draft PR:** _(pending)_  
**Flag:** `security.secret_manager` (default OFF)

```
┌─────────────────────────────────────────────┐
│         Provider adapters (Amadeus / …)     │
│     readLiveProviderSecret(key)  [bridge]   │
└──────────────────────┬──────────────────────┘
                       │ flag ON
                       ▼
┌─────────────────────────────────────────────┐
│              SecretManager                  │
│  get / has / getProviderCredentials         │
│  audit (redacted) · diagnostics (safe)      │
└──────────────────────┬──────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
 EnvironmentSecret   FutureVault   Memory
 Provider (live)     (live=false)  (tests)
          │
          ▼
   process.env / Vite env injection
   (.env · Vercel · GitHub Actions)
```

**Rule:** EnvironmentSecretProvider is the only component that reads environment variables.  
**Future:** Vault / AWS / GCP / Azure backends remain stubs (`live=false`).
