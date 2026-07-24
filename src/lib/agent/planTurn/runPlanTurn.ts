import { rebuildConciergeStateFromMessages } from '../../concierge/meta'
import type { TravelAgentTurnInput, TravelAgentTurnResult } from '../travelAgentService'
import { assertTurnNotAborted } from './abortCheckpoint'
import type { PlanTurnDeps } from './context'
import {
  stageAutonomous,
  stageBrainPipeline,
  stageConcierge,
  stageEarlyIntentRouters,
  stageFinalSpeak,
  stageInitMemory,
  stageLlmAndTools,
  stagePreBrainEnrichers,
  stageRahhalBrain,
  stagePresentation,
} from './stages'
import { autonomous } from './stages/autonomous'
import { brainPipeline } from './stages/brainPipeline'
import { concierge } from './stages/concierge'
import { earlyIntentRouters } from './stages/earlyIntentRouters'
import { finalSpeak } from './stages/finalSpeak'
import { initMemory } from './stages/initMemory'
import { llmAndTools } from './stages/llmAndTools'
import { preBrainEnrichers } from './stages/preBrainEnrichers'
import { presentation as buildPresentation } from './stages/presentation'
import { rahhalBrain } from './stages/rahhalBrain'

export async function runPlanTurn(
  input: TravelAgentTurnInput,
  deps: PlanTurnDeps,
): Promise<TravelAgentTurnResult> {
  assertTurnNotAborted(input.signal)
  const ctx = stageInitMemory(input.signal, () => initMemory(input, deps))

  stagePreBrainEnrichers(() => preBrainEnrichers(ctx, deps))

  const rahhalStageResult = await stageRahhalBrain<TravelAgentTurnResult | null>(() =>
    rahhalBrain(ctx, deps),
  )
  if (rahhalStageResult) return rahhalStageResult

  // Sprint 20–27 — every user message through Brain when flags are on.
  ctx.travelEngineOn = deps.isTravelEngineEnabled()
  ctx.tripPlanningOn = deps.isTripPlanningEnabled()
  ctx.executionOn = deps.isExecutionEnabled()
  ctx.searchOn = deps.isSearchEnabled()
  ctx.orchestratorOn = deps.isTripOrchestratorEnabled()
  await stageBrainPipeline(() => brainPipeline(ctx, deps))

  const earlyIntentRouterResult = await stageEarlyIntentRouters<TravelAgentTurnResult | null>(() =>
    earlyIntentRouters(ctx, deps),
  )
  if (earlyIntentRouterResult) return earlyIntentRouterResult

  ctx.conciergeState = rebuildConciergeStateFromMessages(
    input.messages.slice(0, -1),
  )

  const conciergeStageResult = await stageConcierge<TravelAgentTurnResult | null>(input.signal, () =>
    concierge(ctx, deps),
  )
  if (conciergeStageResult) return conciergeStageResult

  await stageLlmAndTools(input.signal, () => llmAndTools(ctx, deps))

  stageAutonomous(() => autonomous(ctx, deps))

  const presentation = stagePresentation(() => buildPresentation(ctx))
  return stageFinalSpeak<TravelAgentTurnResult>(input.signal, () =>
    finalSpeak(ctx, deps, presentation),
  )
}
