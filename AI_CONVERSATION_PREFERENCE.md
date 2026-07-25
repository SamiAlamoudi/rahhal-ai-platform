# Conversation Preference — Phase 7 Stage 4

## Contracts

| Contract | Role |
|----------|------|
| `ConversationPreferenceParserContract` | Parse mode hint (`architecture_placeholder`) |
| `ExplicitPreferenceDetectorContract` | Explicit utterance hints (empty) |
| `ImplicitPreferenceDetectorContract` | Implicit signal hints (empty) |
| `PreferenceSourcesContract` | Source kinds catalog |

## Source kinds

`explicit_utterance` · `implicit_signal` · `conversation_history` · `revision` · `merge` · `architecture_placeholder`

## Design intent

Travelers never fill traditional forms (`formFillingRequired: false`).  
Preferences are discovered continuously from conversation history — architecture only in this stage.
