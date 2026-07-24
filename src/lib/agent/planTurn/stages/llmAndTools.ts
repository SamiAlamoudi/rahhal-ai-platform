import { assertTurnNotAborted } from '../abortCheckpoint'
import { applyTripPlanEdits, regenerateTripDay } from '../../buildItinerary'
import { hasPlanningPatch } from '../helpers'
import { withTripPlan } from '../../types'
import type { PlanTurnContext, PlanTurnDeps, RunToolsForPlanResult } from '../context'

function applyRunResults(ctx: PlanTurnContext, ran: RunToolsForPlanResult): void {
  ctx.toolBatch = ran.batch
  if (ran.autonomous) ctx.autonomousSnapshot = ran.autonomous
  if (ran.bookingIntelligence) ctx.bookingIntelligenceResult = ran.bookingIntelligence
  if (ran.budgetIntelligence) ctx.budgetIntelligenceResult = ran.budgetIntelligence
  if (ran.travelPlanner) ctx.travelPlannerResult = ran.travelPlanner
  if (ran.travelerPersonalization) {
    const priorLearning = ctx.travelerPersonalizationResult?.diagnostics.learningEvents ?? []
    ctx.travelerPersonalizationResult = {
      ...ran.travelerPersonalization,
      diagnostics: {
        ...ran.travelerPersonalization.diagnostics,
        learningEvents: priorLearning.length > 0
          ? priorLearning
          : ran.travelerPersonalization.diagnostics.learningEvents,
      },
    }
  }
  if (ran.tripOptimizer) ctx.tripOptimizerResult = ran.tripOptimizer
  if (ran.autonomousDecision) ctx.autonomousDecisionResult = ran.autonomousDecision
  if (ran.priceIntelligence) ctx.priceIntelligenceResult = ran.priceIntelligence
  if (ran.dynamicPackages) ctx.dynamicPackagesResult = ran.dynamicPackages
  if (ran.itineraryRefinement) ctx.itineraryRefinementResult = ran.itineraryRefinement
  if (ran.bookingExecution) ctx.bookingExecutionResult = ran.bookingExecution
  if (ran.payments) ctx.paymentsResult = ran.payments
}

export async function llmAndTools(ctx: PlanTurnContext, deps: PlanTurnDeps): Promise<void> {
  const llm = deps.llms.getActive()
  assertTurnNotAborted(ctx.input.signal)
  const llmResult = await llm.complete({
    conversationId: ctx.input.conversationId,
    messages: ctx.input.messages,
    memory: ctx.memory,
    locale: ctx.memory.locale,
    signal: ctx.input.signal,
  })

  if (ctx.extracted.intent === 'save') {
    if (!ctx.memory.tripPlan) {
      ctx.objective = 'explain_unavailable'
      ctx.memory.phase = 'collecting'
    } else if (deps.savePlanHook) {
      const saved = await deps.savePlanHook({
        conversationId: ctx.input.conversationId,
        tripPlan: ctx.memory.tripPlan,
      })
      ctx.savedTitle = saved?.title || ctx.memory.tripPlan.title
      ctx.objective = 'acknowledge_save'
      ctx.memory.phase = 'planned'
    } else {
      ctx.objective = 'acknowledge_save'
      ctx.savedTitle = ctx.memory.tripPlan.title
      ctx.memory.phase = 'planned'
    }
  } else if (ctx.extracted.intent === 'regenerate_day' && ctx.memory.tripPlan) {
    const existingPlan = ctx.memory.tripPlan
    const day = ctx.extracted.patch.regenerateDay
      ?? ctx.memory.requirements.regenerateDay
      ?? 1
    ctx.memory = {
      ...ctx.memory,
      requirements: {
        ...ctx.memory.requirements,
        regenerateDay: day,
        regenerateScope: 'day',
      },
      lastIntent: 'regenerate_day',
      missingFields: [],
    }
    const refreshedDay = regenerateTripDay(existingPlan, day, ctx.memory.locale)
    assertTurnNotAborted(ctx.input.signal)
    const ran = await deps.runToolsForPlan({
      memory: ctx.memory,
      conversationId: ctx.input.conversationId,
      userText: ctx.userText,
      signal: ctx.input.signal,
      basePlan: refreshedDay,
      priorAutonomous: ctx.priorAutonomous,
      onProgress: ctx.input.onProgress,
      travelPlanner: ctx.travelPlannerResult,
    })
    applyRunResults(ctx, ran)
    ctx.memory = withTripPlan({ ...ctx.memory, phase: 'editing', missingFields: [] }, ran.plan)
    ctx.objective = 'present_plan'
  } else if (ctx.extracted.intent === 'edit' && !hasPlanningPatch(ctx.extracted.patch) && ctx.memory.tripPlan) {
    ctx.objective = 'acknowledge_edit'
    ctx.memory.phase = 'editing'
  } else if (
    (
      ctx.extracted.intent === 'regenerate'
      || ctx.extracted.intent === 'edit'
      || ctx.extracted.intent === 'plan'
      || ctx.extracted.intent === 'answer'
      || ctx.alphaJourneyCue
    )
    && ctx.memory.missingFields.length === 0
  ) {
    const scope = ctx.memory.requirements.regenerateScope
      ?? ctx.extracted.patch.regenerateScope
      ?? (ctx.extracted.intent === 'regenerate' ? 'whole' : null)
    ctx.memory = {
      ...ctx.memory,
      requirements: {
        ...ctx.memory.requirements,
        regenerateScope: scope,
      },
    }
    const scoped = scope === 'flight' || scope === 'hotel' || scope === 'activities'
    const basePlan = ctx.memory.tripPlan && ctx.extracted.intent === 'edit'
      ? applyTripPlanEdits(ctx.memory.tripPlan, ctx.extracted.patch, ctx.memory.locale)
      : (scoped && ctx.memory.tripPlan ? ctx.memory.tripPlan : undefined)
    const seed = ctx.extracted.intent === 'regenerate' && (!scope || scope === 'whole')
      ? `regen-${Date.now()}`
      : undefined
    assertTurnNotAborted(ctx.input.signal)
    const ran = await deps.runToolsForPlan({
      memory: ctx.memory,
      conversationId: ctx.input.conversationId,
      userText: ctx.userText,
      signal: ctx.input.signal,
      seed,
      basePlan,
      priorAutonomous: ctx.priorAutonomous,
      onProgress: ctx.input.onProgress,
      travelPlanner: ctx.travelPlannerResult,
    })
    let plan = ran.plan
    applyRunResults(ctx, ran)
    if (llmResult.draft?.notes?.length) {
      plan = { ...plan, notes: [...plan.notes, ...llmResult.draft.notes] }
    }
    ctx.memory = withTripPlan({ ...ctx.memory, phase: 'planned', missingFields: [] }, plan)
    ctx.objective = 'present_plan'
  } else if (ctx.memory.missingFields.length > 0) {
    ctx.memory = withTripPlan({ ...ctx.memory, phase: 'collecting' }, ctx.memory.tripPlan)
    ctx.objective = 'collect_missing'
  } else if (ctx.memory.tripPlan) {
    const existingPlan = ctx.memory.tripPlan
    ctx.memory = withTripPlan({ ...ctx.memory, phase: 'planned' }, existingPlan)
    ctx.objective = 'present_plan'
  } else {
    ctx.objective = 'collect_missing'
  }
}
