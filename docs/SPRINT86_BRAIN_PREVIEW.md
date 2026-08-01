# Sprint 86 — Brain v1 Preview Integration (Safe Pilot)

**Branch:** `cursor/sprint86-brain-preview-71ec`  
**Flags:**
- `ai.brain.v1` — **OFF**, remains in `RECOVERY_FROZEN_OFF_FLAGS`
- `ai.brain.v1.preview` — **OFF by default**, not frozen; production hard-blocked

**Turn owner:** `travelAgentService.planTurn` (unchanged)

## Goal

Wire Brain Foundation (Sprints 81–85) into the live conversation spine as a **safe preview pilot**:

- Production continues to use the current planner when the preview flag is OFF (default).
- On non-production deploy targets, enabling the preview flag lets BrainRouter orchestrate Conversation Manager (Value Before Questions).
- Any Brain exception → automatic silent fallback to the current planner.

## Architecture

```text
User Input
  → chatEngine / travel-agent provider
  → travelAgentService.planTurn()          ← sole turn owner
       ├─ preview flag OFF  → Current Planner (unchanged)
       └─ preview flag ON
            → BrainRouter
                 ├─ ConversationManager (AssumptionEngine, ValueFirstPlanner, …)
                 │     → TravelAgentTurnResult (brain path)
                 └─ on exception / empty → Current Planner (fallback)
  → UI (unchanged)
```

No UI / Voice / STT / TTS / booking / payments changes.

## Brain Router rules

| Condition | Path |
| --- | --- |
| `ai.brain.v1.preview` OFF | Current planner |
| Preview ON + Brain success | Brain orchestration reply |
| Preview ON + Brain throws / empty | Current planner (fallback) |
| Production deploy target | Always current planner (hard block) |

Optional Preview env: `VITE_BRAIN_V1_PREVIEW=true` (ignored on production targets).

## Modules

```text
src/lib/brain/v1/preview/
  feature.ts       — flag + deploy gate
  BrainRouter.ts   — route / try / fallback
  sessionStore.ts  — multi-turn session via providerMeta
  index.ts
```

Orchestration reuses (no redesign):

- AssumptionEngine
- ValueFirstPlanner
- ClarificationPolicy / QuestionGenerator
- ConversationManager + memory adapter
- Travel planning / reasoner via existing ConversationManager → TravelPlanningEngine

## Guardrails preserved

- `RECOVERY_TURN_OWNER = travelAgentService.planTurn`
- `ai.brain.v1` stays in `RECOVERY_FROZEN_OFF_FLAGS`
- Foundation island entrypoints still no-op when `ai.brain.v1` is OFF
- Existing Brain 81–85 tests unchanged in intent

## Verify

```bash
npm run brain-preview:verify
npm run brain-v1:verify
npm run brain-conversation:verify
npm run conversation:verify
npm run typecheck && npm run lint && npm run build
npm run test:run -- src/lib/__tests__/recoveryPhase1.freeze.test.ts
```

## Risk assessment

| Risk | Mitigation |
| --- | --- |
| Preview Brain reply quality | Value Before Questions already tested; fallback on any throw |
| Production accidental enable | Deploy-target hard block + default OFF |
| Module graph cost when OFF | Dynamic import of BrainRouter only when preview flag is ON |
| Session loss across turns | Persist ConversationSession on `meta.brainV1Preview.session` |
| Freeze policy conflict | Preview uses a **separate** non-frozen flag; foundation flag stays frozen |

## Out of scope

- Enabling Brain in production
- UI changes
- Sprint 87
- Redesigning ConversationManager / AssumptionEngine / planners
