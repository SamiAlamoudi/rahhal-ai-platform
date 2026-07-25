# Intent Schema — Phase 7 Stage 6

**Source:** contracts in `src/lib/orchestration/intentEngine/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `TravelerIntent` | intentId · intentKind · domainHint |
| `IntentPrediction` | predictionId · intentKind · rankHint |
| `IntentConfidence` | intentId · scoreHint · bandHint |
| `IntentTransition` | fromIntent · toIntent · reasonHint |
| `IntentValidation` | intentId · valid · issues |
| `MultiIntentResult` | resultId · intents · primaryHint |

## Schema contract

`IntentSchemaContract` lists all `INTENT_KINDS` and `INTENT_DOMAINS`.  
`IntentRegistryContract` maps each kind to a domain with `enabledHint: false`.

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
