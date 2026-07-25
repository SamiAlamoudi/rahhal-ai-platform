# Security Configuration

## Feature flags

| Flag | Default | Purpose |
|------|---------|---------|
| `security.secret_manager` | **OFF** | Extra audit/authz path for live provider secret bridge |

Managed env access is always routed through SecretManager → EnvironmentSecretProvider, even when the flag is OFF (additive migration).

## Scopes

| Scope | Allowed surfaces |
|-------|------------------|
| `server_only` | Node / Edge / CI — never frontend bundles |
| `client_safe` | SPA-safe (e.g. Supabase anon) |
| `ephemeral_client` | Legacy SPA keys (discouraged) |
| `public_config` | Non-secret toggles and URLs |

## Startup modes

| Mode | Critical missing | Optional missing |
|------|------------------|------------------|
| development | warn / continue | graceful disable |
| production | **fail hard** | graceful disable |

## Git hygiene

`.gitignore` must include:

```
.env
.env.local
.env.production
.env.*.local
*.pem
*.key
secrets.*
credentials.*
```

`.env.example` uses placeholders only.

## CI

1. `bash scripts/secret-hygiene-scan.sh` (existing)
2. `npm run security:gate` (Sprint 14)
3. Existing typecheck / lint / test / build / audit unchanged
