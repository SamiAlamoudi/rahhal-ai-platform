# Autonomous AI Agent Orchestrator — Phase 6

**Status:** Additive · Feature flag **OFF** · Draft PR only · No UI redesign · Production APIs **disabled**  
**Continues from:** Phase 5 LLM Conversation Brain (#259)  
**Spine:** `chatEngine` → `travelAgentService.planTurn` (unchanged ownership)

Flag: `ai.autonomous_agent_orchestrator` (default **OFF**)  
Distinct from frozen Sprint 113 `ai.orchestrator` and Sprint 54 `ai.autonomous_agent`.

## Package layout

Sprint 113 modules under `src/lib/agent/orchestrator/` are **preserved**.  
Phase 6 lives additively in:

`src/lib/agent/orchestrator/autonomous/`

| Module | Role |
|--------|------|
| `AgentOrchestrator` | Mission loop orchestrator |
| `TaskPlanner` | Multi-step task ladder |
| `GoalManager` | Travel goal + change detection |
| `ExecutionPlanner` | Mission plan builder (`MissionExecutionPlanner`) |
| `ExecutionState` | Current task / phase / retries |
| `ToolOrchestrator` | Dynamic tool routing |
| `DecisionEngine` | Debug-only recommendation explanations |
| `TaskQueue` | Priority / unblocking clarifications |
| `WorkflowManager` | searching · waiting · retry · resume · cancel |
| `RecoveryManager` | Failures · estimates · clarify · replan |
| `ExecutionMemory` | Conversation / preference / task / profile memory |

## Agent lifecycle

```text
User utterance
      |
      v
GoalManager (update / detect change)
      |
      +-- change? --> Dynamic Replan
      |
      v
TaskPlanner -> MissionExecutionPlanner
      |
      v
TaskQueue (priority)
      |
      v
Execute auto-safe tasks (no production APIs)
      |
      v
ToolOrchestrator (choose tool, do not invoke live APIs)
      |
      v
RecoveryManager (fallback / estimate / clarify)
      |
      v
DecisionEngine (debug explanations only)
      |
      v
ExecutionMemory + timeline -> meta.autonomousOrchestrator
```

## Mission lifecycle (example)

User: "I want a honeymoon in Japan."

```text
Understand request
  -> Collect missing (season if needed)
  -> Determine best season
  -> Estimate budget
  -> Flight strategy
  -> Hotel strategy
  -> Activities
  -> Visa check
  -> Search (APIs disabled — staged only)
  -> Compare
  -> Reason
  -> Recommend
  -> Wait for approval
  -> Final itinerary
```

## Execution diagram

```text
[pending] --> [running] --> [done]
                |              ^
                +--> [blocked] --clarification--> resume
                +--> [retry] ----fallback tool--> continue_with_estimate
                +--> [waiting] --approval--> [build_itinerary]
                +--> [cancelled]
```

## Workflow examples

**Destination change**

> Actually make it Korea.  
> → GoalManager bumps version → full replan → timeline `replan`

**Budget change**

> Budget changed to SAR 8000.  
> → Recalculate budget task / mission goal

**Companion unavailable**

> My wife can't travel.  
> → travelers=1 · conflict note vs honeymoon · hotel/flight strategy adjusted

**Short trip**

> I only have 5 days.  
> → activities priority elevates · compact itinerary decision (debug)

## Recovery examples

| Failure | Recovery |
|---------|----------|
| flights tool fails | use_fallback_tool (hotels) + continue_with_estimate |
| missing season | ask one unblocking clarification |
| low confidence | ask vibe/date clarification |
| Japan + 2 days | conflict warning + self-correct notes |

## Observability

`meta.autonomousOrchestrator.timeline` — mission / task / tool / recovery / replan.  
Decision explanations are `debugOnly: true` — **never production UI**.

## Integration rules

- Flag **OFF** → zero behavior change.  
- When ON: soft-merge requirements + attach meta.  
- Does not call live search/booking APIs.  
- Does not remove Sprint 113 orchestrator modules.  
- Draft only — do not merge.

## Test report

Suite: `src/lib/__tests__/autonomousOrchestrator.phase6.test.ts`  
Validate: `npm run lint`, `npm run typecheck`, `npm run arch:circular`, `npm run test:run`.
