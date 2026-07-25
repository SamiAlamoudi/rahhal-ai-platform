# Context Schema — Phase 7 Stage 5

**Source:** output contracts in `src/lib/orchestration/travelerContextEngine/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `TravelerContext` | travelerIdHint · stateHints |
| `ConversationContext` | conversationId · intentHint · goalHints |
| `TripContext` | tripIdHint · destinationHints |
| `SessionContext` | sessionId · locale |
| `ContextSnapshot` | snapshotId · atIso · sectionHints |
| `ContextConfidence` | scoreHint · bandHint |
| `ContextValidation` | valid · issues |

## Supporting contracts

Conversation · Travel · Trip · Traveler State · Session · Environment · Constraint · Budget · Destination · Timeline · Companion · Weather · Transportation · Accommodation · Activity · Visa · Current Goal · Snapshot · Confidence · Freshness · Merge Rules · Priorities · Validation

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
