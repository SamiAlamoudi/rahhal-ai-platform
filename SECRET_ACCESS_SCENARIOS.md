# Secret Access — Scenarios (Sprint 14)

**Branch:** `cursor/production-security-secrets-7518`  
**Draft PR:** [#277](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/277)  
**Flag:** `security.secret_manager` (default OFF)

---

## 1. Flag OFF (default)

| Actor | Behavior |
|---|---|
| `readLiveProviderSecret` | Legacy `readEnv` (unchanged) |
| SecretManager API | Available for new callers; registry reports disabled |

---

## 2. Flag ON — Amadeus credentials

```
resolveProviderCredentials('amadeus')
  → AMADEUS_API_KEY | AMADEUS_CLIENT_ID
  → AMADEUS_API_SECRET | AMADEUS_CLIENT_SECRET
```

Complete only when both present. Values never logged.

---

## 3. Flag ON — Duffel / Booking

| Provider | Required keys |
|---|---|
| duffel | `DUFFEL_API_TOKEN` |
| booking | `BOOKING_API_KEY` \| `RAPIDAPI_KEY` \| `BOOKING_RAPIDAPI_KEY` |

---

## 4. Redaction

Access audit stores `ab…ij` style previews only. `assertNoSecretLeak` fails if raw secrets appear in payloads.

---

## 5. Future vault

`FutureVaultSecretProvider.live === false` — always empty until a later production sprint.
