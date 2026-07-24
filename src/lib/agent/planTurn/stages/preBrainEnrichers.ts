import { runAdaptiveLearningTurn } from '../../adaptiveLearning'
import { runTravelerPersonalization } from '../../travelerPersonalization'
import { runTravelPlanner } from '../../travelPlanner'
import type { PlanTurnContext, PlanTurnDeps } from '../context'

export function preBrainEnrichers(ctx: PlanTurnContext, deps: PlanTurnDeps): void {
  // Sprint 78 — Travel Strategy Planner runs before any search engines.
  if (deps.isTravelPlannerOn()) {
    ctx.travelPlannerResult = runTravelPlanner({
      userText: ctx.userText,
      memory: ctx.memory,
      locale: ctx.memory.locale,
    })
  }

  // Sprint 76 — learn preferences from conversation even when tools do not run.
  if (deps.isTravelerPersonalizationOn()) {
    ctx.travelerPersonalizationResult = runTravelerPersonalization({
      userId: ctx.input.conversationId,
      userText: ctx.userText,
      memory: ctx.memory,
    })
  }

  // Sprint 80 — adaptive learning (local preference adaptation) before Decision Engine.
  if (deps.isAdaptiveLearningOn()) {
    ctx.adaptiveLearningResult = runAdaptiveLearningTurn({
      userId: ctx.input.conversationId,
      userText: ctx.userText,
      enabled: deps.options.adaptiveLearningEnabled,
    })
  }
}
