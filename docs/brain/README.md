# AI Travel Brain — Foundation

Internal architecture that powers Rahhal as a travel consultant.

**Status:** Foundation only (mocks).  
**Path:** `src/brain/`  
**Not wired to:** UI · Design System · Brand · BrainRouter · Amadeus · Booking · external AI SDKs.

## Architecture

```text
src/brain/
  memory/           Conversation + short/long-term memory interfaces, sessions
  conversation/     Conversation State Manager
  intent/           Intent Engine (AR/EN)
  entities/         Entity Extractor (AR/EN)
  preferences/      Preference Engine (learned signals, no hardcoding)
  context/          Reference resolution (there, same hotel, next week…)
  reasoner/         Travel Reasoner (mock knowledge)
  recommendation/   Scored ranking over mock inventory
  decision/         Chooses tool — does not execute
  tool-router/      Intent → tool id catalog (execute: false)
  travel/           Draft models + mock catalog
  personality/      Luxury consultant tone
  pricing/          Mock price bands / trends
  timeline/         Journey timeline builder
  safety/           Missing / ambiguous / impossible / contradictory
  planner/          Trip plan skeleton
  TravelBrain.ts    In-process facade
```

## Principles

1. Architecture-first, strict TypeScript  
2. Mock implementations only  
3. No runtime provider integrations  
4. No BrainRouter / UI coupling  
5. Calm, confident, helpful, concise personality  
6. Safety before tool routing  

## Usage (foundation)

```ts
import { createTravelBrain } from '../brain'

const brain = createTravelBrain()
await brain.begin('user-1', 'ar')
const result = brain.handleUserText('أريد حجز طيران من الرياض إلى إسطنبول')
```

## Verification

```bash
npm run typecheck
npm run lint
npm run test:run -- src/brain
npx vitest run --coverage src/brain
npm run build
```

## Out of scope (this phase)

- Provider integrations  
- Live booking  
- BrainRouter runtime wiring  
- UI / Design System / Brand changes  
