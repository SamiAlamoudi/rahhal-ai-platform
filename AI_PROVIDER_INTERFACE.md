# LLM Provider Interface — Phase 6 Stage 8

**Source:** `LlmProviderInterfaceContract` / `LlmProviderContract` in `src/lib/orchestration/llmAdapter/`

## Interface (declarative methods)

| Method hint | Meaning |
|-------------|---------|
| `prepareRequest` | Shape a provider-agnostic request placeholder |
| `prepareResponse` | Accept a response placeholder |
| `normalize` | Map to unified response shape |
| `accountTokens` | Token accounting hints |
| `hintCost` | Cost model hints |

All methods are **names only** — no SDK calls, no HTTP.

## Per-provider contracts

Each `LlmProviderId` has a `LlmProviderContract` with:

- `providerId` / `label`
- `capabilitiesHint` (e.g. `chat_placeholder`, `no_sdk`)
- `execution: 'none'`

Providers are interchangeable at the architecture layer; selection/ranking are separate contracts.
