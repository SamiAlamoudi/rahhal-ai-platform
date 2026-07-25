# NEW_UX_VALIDATION_REPORT — Product Sprint A

## Feature flag

`ui.new_experience` — **default OFF**. Enable in staging to exercise the new UI; leave OFF for production rollback.

## Journey checklist (manual / staging)

| # | Journey | Expected (flag ON) |
|---|---------|---------------------|
| 1 | Arabic trip to Morocco | Home suggestion / chat seed → Arabic RTL UI |
| 2 | Missing info only | Existing planTurn clarification (engine unchanged) |
| 3 | Flight + hotel in chat | `ConversationResults` cards inside bubble |
| 4 | Cheaper option | Suggested reply / user message; cards refresh via seed |
| 5 | Budget breakdown | `BudgetBreakdownCard` when budget context present / demo |
| 6 | Accept plan | Itinerary timeline appears |
| 7 | Itinerary | Day groups + expand |
| 8 | Modify day conversationally | “Edit in chat” seeds command |
| 9 | Disruption | Recovery recommendation card |
| 10 | Booking preview | `ActionConfirmationCard` requires explicit confirm (no live txn) |

Also: English, mixed AR/EN, business, family, budget, multi-city — covered by locale props + existing engine.

## Automated

`src/lib/__tests__/productUx.sprintA.test.ts` — flag default, tokens, copy RTL/LTR, adapters, component trees.

## Non-goals verified

- No new AI engine / provider / live booking or payment.
- Recovery chat spine unchanged: LegacyChatPage → chatEngine → planTurn.
