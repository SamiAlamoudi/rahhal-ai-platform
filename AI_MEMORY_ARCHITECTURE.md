# Memory Architecture — Phase 6 Stage 5

## Store kinds

`conversation` · `session` · `traveler_profile` · `preference` · `destination` · `trip_history` · `document` · `relationship` · `entity` · `knowledge_reference`

Each maps to a `MemoryStoreContract` with `persisted: false`.

## Domain memory contracts

| Contract | Contents (shape only) |
|----------|------------------------|
| Conversation | turn refs, summaries |
| Session | key/value slot hints |
| Traveler profile | field names |
| Preference | preference strings |
| Destination | destination labels |
| Trip history | trip refs |
| Document | document refs |
| Relationship | id/label pairs |
| Entity | id/type/label |
| Knowledge refs | id/source hints |

## Session & state

States: `idle` → `collecting` → `writing` → `retrieving` → `ranking` → `merging` → `retaining` → `ready` → `closed`
