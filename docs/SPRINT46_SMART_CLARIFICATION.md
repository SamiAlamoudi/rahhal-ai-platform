# Sprint 46 — Smart Clarification / Never-Ask-Twice

Make Rahhal stop interrogating travelers like a booking form.

## Product rule

> Never ask unnecessary questions. Infer as much as possible.

Hard requirements may still block planning. Soft preferences must be inferred.

## Hard vs soft

| Hard (may ask) | Soft (never form-ask — always infer) |
|----------------|--------------------------------------|
| destination* | travelerType |
| durationDays / dates | interests |
| budgetAmount (or flexible) | weatherPreference |
| travelers | budgetStyle |
| | hotelPreference |
| | packageScope |

\*Open-ended discovery (`destinationFlexible`, Sprint 45) still skips destination asks.

## Architecture

```
planTurn
  → extract + preference seed + reasoning
  → applySmartClarification (infer soft slots)
  → missingRequirementFields (hard only when flag ON)
  → concierge / tools / plan
```

| Module | Path |
|--------|------|
| Engine | `src/lib/agent/clarification/smartClarification.ts` |
| Flag helper | `src/lib/agent/clarification/feature.ts` |
| Wiring | `src/lib/agent/memory.ts`, `src/lib/agent/travelAgentService.ts` |

## Feature flag (default **ON**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `smart_clarification` | `ai.smart_clarification` | `ai.concierge` |

## Inference examples

- 2 travelers → couple
- empty interests → `any` (balanced plan)
- unset weather → `flexible`
- budget per person/day → luxury / midrange / budget
- business purpose → `flights_only` + central hotel
- leisure → `full_package`

Never overwrites explicit user statements.

## User-visible outcome

Before: “5 days Japan, $3000, 2 people” → still asked weather / hotel / package / interests.

After: same utterance → full trip plan with inferred soft defaults + clarification meta.

## Tests

`src/lib/__tests__/smartClarification.sprint46.test.ts`
