import {
  brainMemoryToRequirementsPatch,
  runIntegratedBrainPipeline,
  toMetaBrain,
} from '../../../brain/integration'
import { getOrCreateAITripOrchestrator } from '../../../brain/orchestrator'
import type { BrainTurnResult } from '../../../brain/types'
import type { SearchAggregationTurnResult } from '../../../brain/search'
import {
  detectBookingFlowConversationEdit,
  getBookingFlowController,
  searchOptionsToBookingSelectedItems,
} from '../../../bookingFlow'
import { getBookingHistoryUserId } from '../../../booking'
import { applySmartClarification, mergeRequirements, missingRequirementFields } from '../../memory'
import { withTripPlan } from '../../types'
import type { PlanTurnContext, PlanTurnDeps } from '../context'

export async function brainPipeline(ctx: PlanTurnContext, deps: PlanTurnDeps): Promise<void> {
  if (deps.isBrainEnabled() && ctx.userText.trim()) {
    let brainResult: BrainTurnResult | null = null

    if (ctx.orchestratorOn) {
      const orchestrator = getOrCreateAITripOrchestrator()
      const orchResult = await orchestrator.runTurn({
        conversationId: ctx.input.conversationId,
        userText: ctx.userText,
        locale: ctx.memory.locale,
        requirements: ctx.memory.requirements,
        signal: ctx.input.signal,
        userId: getBookingHistoryUserId() || ctx.input.conversationId,
        bookingFlow: deps.isFlowEnabled(),
      })
      brainResult = (orchResult.brain as BrainTurnResult | null) ?? null
      if (brainResult) {
        ctx.brainMeta = toMetaBrain(brainResult, orchResult)
      }
    } else {
      brainResult = await runIntegratedBrainPipeline({
        conversationId: ctx.input.conversationId,
        userText: ctx.userText,
        locale: ctx.memory.locale,
        requirements: ctx.memory.requirements,
        travelEngine: ctx.travelEngineOn || ctx.tripPlanningOn || ctx.executionOn || ctx.searchOn,
        tripPlanning: ctx.tripPlanningOn || ctx.executionOn || ctx.searchOn,
        execution: ctx.executionOn || ctx.searchOn,
        search: ctx.searchOn,
        signal: ctx.input.signal,
      })
      ctx.brainMeta = toMetaBrain(brainResult)
    }

    if (
      brainResult &&
      (deps.isBrainHandoffEnabled() ||
        ctx.travelEngineOn ||
        ctx.tripPlanningOn ||
        ctx.executionOn ||
        ctx.searchOn ||
        ctx.orchestratorOn)
    ) {
      ctx.memory = {
        ...ctx.memory,
        requirements: mergeRequirements(
          ctx.memory.requirements,
          brainMemoryToRequirementsPatch(brainResult.context.memory),
        ),
      }
      if (deps.isClarificationEnabled()) {
        const clarified = applySmartClarification(ctx.memory.requirements, {
          locale: ctx.memory.locale,
          enabled: true,
        })
        ctx.memory = { ...ctx.memory, requirements: clarified.requirements }
      }
      ctx.memory.missingFields = missingRequirementFields(ctx.memory.requirements, {
        smart: deps.isClarificationEnabled(),
      })
      ctx.memory = withTripPlan(ctx.memory, ctx.memory.tripPlan ?? ctx.memory.itinerary)
    }

    // Sprint 22 — apply complete engine TripPlan into agent memory (booking workflow).
    const enginePlan = ctx.brainMeta?.engineTripPlan
    if (
      ctx.brainMeta &&
      (ctx.tripPlanningOn || ctx.executionOn || ctx.searchOn || ctx.orchestratorOn) &&
      enginePlan?.status === 'complete' &&
      enginePlan.agentTripPlan
    ) {
      ctx.memory = withTripPlan(
        { ...ctx.memory, phase: 'planned', missingFields: [] },
        enginePlan.agentTripPlan,
      )
    }

    // Sprint 25 — booking flow orchestration (edits + brain sync; no planning restart).
    // When Sprint 27 orchestrator is on, booking attach already ran inside AITripOrchestrator.
    if (deps.isFlowEnabled() && !ctx.orchestratorOn && brainResult) {
      const flowUserId = getBookingHistoryUserId() || ctx.input.conversationId
      const controller = getBookingFlowController()
      let flow =
        controller.restoreLatest(flowUserId) ??
        controller.createFlow({
          userId: flowUserId,
          conversationId: ctx.input.conversationId,
          currency: ctx.memory.requirements.budgetCurrency || 'SAR',
          budget: {
            amount: ctx.memory.requirements.budgetAmount ?? null,
            currency: ctx.memory.requirements.budgetCurrency ?? 'SAR',
          },
          dates: {
            startDate: ctx.memory.requirements.startDate ?? null,
            endDate: ctx.memory.requirements.endDate ?? null,
            durationDays: ctx.memory.requirements.durationDays ?? null,
          },
          travelers: {
            adults: ctx.memory.requirements.travelers ?? null,
            children: null,
            infants: null,
            summary: null,
          },
        })

      controller.setStage(flow.id, 'conversation')
      if (brainResult.planning) controller.setStage(flow.id, 'planning')
      if (brainResult.execution) controller.setStage(flow.id, 'execution')

      const search = brainResult.search as SearchAggregationTurnResult | null
      if (search?.recommendation) {
        flow = controller.attachSearchRecommendation(flow.id, search.recommendation)
        const topOption = search.recommendation.top?.option
        if (topOption && !flow.bookingSessionId) {
          const selected = searchOptionsToBookingSelectedItems([topOption])
          const applied = await controller.applySelection({
            flowId: flow.id,
            items: selected,
          })
          flow = applied.flow
        }
      }

      const edit = detectBookingFlowConversationEdit(ctx.userText)
      if (edit.kind !== 'unknown') {
        const edited = controller.applyConversationEdit(flow.id, ctx.userText)
        flow = edited.flow
      }

      const synced = controller.syncBrain(flow.id, brainResult.context.memory)
      brainResult.context = {
        ...brainResult.context,
        memory: synced.memory,
      }
      ctx.brainMeta = toMetaBrain(brainResult)
      ctx.memory = {
        ...ctx.memory,
        requirements: mergeRequirements(
          ctx.memory.requirements,
          brainMemoryToRequirementsPatch(synced.memory),
        ),
      }
    }
  }
}
