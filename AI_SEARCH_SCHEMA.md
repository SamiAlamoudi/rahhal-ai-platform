# Search Schema — Phase 7 Stage 8

**Source:** output contracts in `src/lib/orchestration/travelSearchOrchestrator/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `SearchRequest` | requestId · providerKinds · destination/date/budget hints · `providerCalled: false` |
| `SearchCandidate` | candidateId · providerKind · labelHint |
| `ProviderRequest` | providerRequestId · providerKind · payloadShapeHint · `sent: false` |
| `ProviderResponse` | providerResponseId · providerKind · `received: false` |
| `SearchResult` | resultId · candidateIds |
| `SearchRanking` | rankingId · orderedCandidateIds |
| `SearchScore` | candidateId · scoreHint |
| `SearchValidation` | requestId · valid · issues |
| `SearchSnapshot` | snapshotId · atIso · requestId |
| `SearchRevision` | revisionId · requestId · reasonHint |

## Input hints

`travel_plan` · `traveler_profile` · `conversation_context` · `intent` · `preferences` · `budget` · `dates` · `destination`

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
