# LLM Provider Registry — Phase 6 Stage 8

**Source:** `LLM_REGISTRY` in `src/lib/orchestration/llmAdapter/registry.ts`

## Entries

| Field | Meaning |
|-------|---------|
| `id` | Registry row id (`lreg-<provider>`) |
| `providerId` | Future provider key |
| `enabledHint` | Always `false` in architecture |
| `rankHint` | Declarative catalog order |

## Catalog

1. openai  
2. claude  
3. gemini  
4. azure_openai  
5. openrouter  
6. local_models  
7. future_providers  

## Selection & ranking

- `LlmProviderSelectionContract` — `selectedProviderId: null` in blueprints  
- `LlmProviderRankingContract` — score hints only; no live routing  

No API keys, credentials, or adapter SDKs are registered.
