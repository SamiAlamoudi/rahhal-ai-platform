# Sprint 87 — Test Report

## Suites

| Suite | Command | Result |
| --- | --- | --- |
| Live Brain Experience | `npm run brain-live:verify` | **13/13 passed** |
| Demo transcripts artifact | `vitest …sprint87.demos.test.ts` | **1/1 passed** |
| Conversation Manager (S85) | `npm run brain-conversation:verify` | **14/14 passed** |
| Brain Preview (S86) | `npm run brain-preview:verify` | **14/14 passed** |
| Brain Reasoning (S81–82) | `npm run brain-v2:verify` | **21/21 passed** |
| Typecheck | `npm run typecheck` | **pass** |
| Lint | `npm run lint` | **pass** (pre-existing unrelated warning) |
| Build | `npm run build` | **pass** |

## Coverage added

- Value-first Morocco/Japan/London/Dubai/Switzerland demos  
- Incremental Morocco → Agadir (same `planId`, destination-only revise)  
- Memory field merge (origin, hotel, food, transport, budget, visa)  
- Clarification budget ≤ 1  
- TravelReasoner destination + trip-style steps  
- Preview router success + exception fallback  
- Never re-ask known origin after refine  

## Production isolation

- `ai.brain.v1.preview` remains **OFF** by default  
- `ai.brain.v1` remains frozen OFF  
- `RECOVERY_TURN_OWNER` unchanged (`travelAgentService.planTurn`)  
