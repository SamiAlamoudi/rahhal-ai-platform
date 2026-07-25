# Planning Constraints — Phase 7 Stage 7

## Contracts

| Contract | Role |
|----------|------|
| `PlanningConstraintsContract` | Constraint list |
| `PlanningConstraint` | Single constraint (`never_book` hard hint in blueprints) |
| `PlanningRulesContract` | deny_booking_side_effects · deny_pricing_calls · require_intent_before_structure |
| `PlanningPrioritiesContract` | intent → constraints → budget → dates → destination → preferences → profile |

Hard constraint in architecture: the engine **never books**.
