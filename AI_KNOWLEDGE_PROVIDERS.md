# Knowledge Providers — Phase 6 Stage 6

**Contract:** `KnowledgeProviderContract`

## Provider kinds

| Kind | Role |
|------|------|
| `internal_catalog` | Covers all domains (placeholder) |
| `curated_document` | FAQ / policy / visa docs |
| `policy_manual` | Reserved kind |
| `reference_table` | Currency / language / timezone / weather refs |
| `external_placeholder` | Airline / airport / hotel — **not live APIs** |

All providers set `execution: 'none'`.

## Sources

One `KnowledgeSourceContract` per coverage domain, pointing at `prov-internal-catalog` by default.

No Amadeus, Google Maps, weather APIs, or network calls.
