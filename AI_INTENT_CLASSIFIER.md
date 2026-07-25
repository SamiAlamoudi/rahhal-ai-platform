# Intent Classifier — Phase 7 Stage 6 (architecture)

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `IntentClassifierContract` | `classifierHint: 'architecture_placeholder'` |
| `IntentConfidenceContract` | `bandHint: 'medium'`, `scoreHint: 0` |
| `IntentPrediction` | rank hint sample only |
| `MultiIntentContract` / `MultiIntentResult` | empty intents; `primaryHint: null` |

## Domains

| Domain | Example intents |
|--------|-----------------|
| `booking` | book_flight · book_hotel · modify_trip · cancel_trip |
| `travel` | plan_trip · compare_destinations · visa_inquiry · budget_advice · transportation · restaurant_recommendation · activity_search |
| `support` | emergency_support · customer_service |
| `conversation` | ask_question · general_conversation · multi_intent · intent_switching |

No ML models, no utterance parsing, no LLM classification.
