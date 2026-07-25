# Provider Abstraction — Phase 7 Stage 8

## Contract

`ProviderAbstractionContract`

| Field | Blueprint default |
|-------|-------------------|
| `providerKinds` | flight · hotel · activity · transport · restaurant · generic_future |
| `adapterHints` | `adapter_<kind>_placeholder` |
| `wired` | `false` |
| `execution` | `'none'` |

## Related outputs

| Contract | Guarantee |
|----------|-----------|
| `ProviderRequest` | `sent: false` |
| `ProviderResponse` | `received: false` |
| `SearchRequest` | `providerCalled: false` |

No SDKs, no HTTP clients, no credentials, no live adapters.
