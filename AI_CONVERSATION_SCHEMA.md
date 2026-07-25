# Conversation Schema — Phase 7 Stage 12

**Source:** output contracts in `src/lib/orchestration/conversationBrain/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `ConversationBrainRequest` | requestId · messageHint · localeHint · `execution: 'none'` |
| `ConversationBrainState` | stateId · requestId · currentStepHint · engineHints |
| `ConversationBrainStep` | stepId · requestId · engineHint · statusHint |
| `ConversationBrainDecision` | decisionId · requestId · decisionHint |
| `ConversationBrainResult` | resultId · requestId · summaryHint · `architectureOnly: true` |
| `ConversationBrainConfidence` | requestId · scoreHint · bandHint |
| `ConversationBrainValidation` | requestId · valid · issues |
| `ConversationBrainSnapshot` | snapshotId · atIso · requestId |
| `ConversationBrainRevision` | revisionId · requestId · reasonHint |

`ConversationBrainResult` here uses kind `phase7_conversation_brain_result` and is **distinct** from `src/lib/agent/conversationBrain` `ConversationBrainResult` (`displayText` / `spokenText`).

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
