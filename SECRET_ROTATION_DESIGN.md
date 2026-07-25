# Secret Rotation Design

Architecture only — **no** AWS Secrets Manager, Google Secret Manager, Azure Key Vault, or HashiCorp Vault integration in this sprint.

## Abstraction

Implemented on `SecretProvider` / `SecretManager` / `SecretRotationController`:

| Method | Behavior |
|--------|----------|
| `refresh()` | Bump rotation version, stamp `lastUpdatedAt`, invalidate caches |
| `reload()` | Reload from backend (env re-read), stamp time, invalidate caches |
| `getVersion()` | Opaque rotation generation string |
| `getLastUpdatedAt()` | ISO timestamp or null |
| `invalidateCache()` | Drop in-memory secret cache |

## Future backends

`FutureVaultSecretProvider` remains `live: false` with capability flags off:

- `awsSecretsManager`
- `gcpSecretManager`
- `azureKeyVault`
- `hashicorpVault`

When a vault backend is added later, it implements the same `SecretProvider` interface and is registered beside `EnvironmentSecretProvider` without changing provider call sites.

## Strategy

1. Rotate credential at source
2. Update host/Edge secret store
3. Deploy or call `reload()` / `refresh()`
4. Confirm `getVersion()` advanced and provider auth succeeds
5. Revoke old credential after soak

## Failure handling

Rotation failures increment `rotationFailureCount` and must not crash conversation for optional providers.
