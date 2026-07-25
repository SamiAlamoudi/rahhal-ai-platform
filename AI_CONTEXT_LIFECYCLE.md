# Context Lifecycle — Phase 7 Stage 5

**Source:** `CONTEXT_LIFECYCLE_ACTIONS`

| Action | Meaning (architecture) |
|--------|------------------------|
| `open` | Open a live context session |
| `refresh` | Refresh freshness / environment hints |
| `merge` | Apply merge rules across facets |
| `validate` | Run validation contract |
| `snapshot` | Emit `ContextSnapshot` |
| `close` | Close session context |

Blueprints do not open live sessions — actions are catalog metadata only.
