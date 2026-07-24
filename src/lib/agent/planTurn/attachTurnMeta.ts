import type { AgentProviderMeta } from '../types'
import { withBrainMeta } from '../../brain/integration'
import type { PlanTurnContext } from './context'
import {
  toMetaAdaptiveLearning,
  toMetaAutonomous,
  toMetaAutonomousDecision,
  toMetaBookingExecution,
  toMetaBookingIntelligence,
  toMetaBudgetIntelligence,
  toMetaDynamicPackages,
  toMetaExecutiveOs,
  toMetaExecutivePlatform,
  toMetaItineraryRefinement,
  toMetaLiveIntelligence,
  toMetaPayments,
  toMetaPriceIntelligence,
  toMetaRahhalBrain,
  toMetaTravelExecutive,
  toMetaTravelerPersonalization,
  toMetaTravelPlanner,
  toMetaTripOptimizer,
} from './helpers'

export const attachBrain = <T extends AgentProviderMeta>(ctx: PlanTurnContext, meta: T): T =>
  withBrainMeta(meta, ctx.brainMeta)

export function attachReasoning<T extends AgentProviderMeta>(ctx: PlanTurnContext, meta: T): T {
  if (!ctx.reasoningMeta) return meta
  return { ...meta, reasoning: ctx.reasoningMeta }
}

export function attachClarification<T extends AgentProviderMeta>(ctx: PlanTurnContext, meta: T): T {
  if (!ctx.clarificationMeta) return meta
  return { ...meta, clarification: ctx.clarificationMeta }
}

export function attachTravelExecutive<T extends AgentProviderMeta>(ctx: PlanTurnContext, meta: T): T {
  if (!ctx.travelExecutiveSnapshot) return meta
  return { ...meta, travelExecutive: toMetaTravelExecutive(ctx.travelExecutiveSnapshot) }
}

export function attachExecutivePlatform<T extends AgentProviderMeta>(ctx: PlanTurnContext, meta: T): T {
  if (!ctx.executivePlatformSnapshot && !ctx.liveIntelligenceSnapshot) return meta
  return {
    ...meta,
    ...(ctx.executivePlatformSnapshot
      ? {
        executivePlatform: toMetaExecutivePlatform(ctx.executivePlatformSnapshot),
        ...(toMetaExecutiveOs(ctx.executivePlatformSnapshot)
          ? { executiveOs: toMetaExecutiveOs(ctx.executivePlatformSnapshot) }
          : {}),
      }
      : {}),
    ...(ctx.liveIntelligenceSnapshot
      ? { liveIntelligence: toMetaLiveIntelligence(ctx.liveIntelligenceSnapshot) }
      : {}),
  }
}

export function attachRahhalBrain<T extends AgentProviderMeta>(ctx: PlanTurnContext, meta: T): T {
  if (!ctx.rahhalBrainMeta) return meta
  return { ...meta, rahhalBrain: toMetaRahhalBrain(ctx.rahhalBrainMeta) }
}

export function attachTurnMeta<T extends AgentProviderMeta>(
  ctx: PlanTurnContext,
  meta: T,
  reply?: string,
): T {
  const withAutonomous = ctx.autonomousSnapshot
    ? { ...meta, autonomous: toMetaAutonomous(ctx.autonomousSnapshot) }
    : meta
  const withBooking = ctx.bookingIntelligenceResult
    ? { ...withAutonomous, bookingIntelligence: toMetaBookingIntelligence(ctx.bookingIntelligenceResult) }
    : withAutonomous
  const withBudget = ctx.budgetIntelligenceResult
    ? { ...withBooking, budgetIntelligence: toMetaBudgetIntelligence(ctx.budgetIntelligenceResult) }
    : withBooking
  const withPersonalization = ctx.travelerPersonalizationResult
    ? {
      ...withBudget,
      travelerPersonalization: toMetaTravelerPersonalization(ctx.travelerPersonalizationResult),
    }
    : withBudget
  const withOptimizer = ctx.tripOptimizerResult
    ? { ...withPersonalization, tripOptimizer: toMetaTripOptimizer(ctx.tripOptimizerResult) }
    : withPersonalization
  const withPlanner = ctx.travelPlannerResult
    ? { ...withOptimizer, travelPlanner: toMetaTravelPlanner(ctx.travelPlannerResult) }
    : withOptimizer
  const withDecision = ctx.autonomousDecisionResult
    ? {
      ...withPlanner,
      autonomousDecision: toMetaAutonomousDecision(ctx.autonomousDecisionResult),
    }
    : withPlanner
  const withLearning = ctx.adaptiveLearningResult
    ? {
      ...withDecision,
      adaptiveLearning: toMetaAdaptiveLearning(ctx.adaptiveLearningResult),
    }
    : withDecision
  const withPrice = ctx.priceIntelligenceResult
    ? {
      ...withLearning,
      priceIntelligence: toMetaPriceIntelligence(ctx.priceIntelligenceResult),
    }
    : withLearning
  const withPackages = ctx.dynamicPackagesResult
    ? {
      ...withPrice,
      dynamicPackages: toMetaDynamicPackages(ctx.dynamicPackagesResult),
    }
    : withPrice
  const withRefinement = ctx.itineraryRefinementResult
    ? {
      ...withPackages,
      itineraryRefinement: toMetaItineraryRefinement(ctx.itineraryRefinementResult),
    }
    : withPackages
  const withConstitution = ctx.constitutionMeta
    ? { ...withRefinement, constitution: ctx.constitutionMeta }
    : withRefinement
  const withConcierge = ctx.conciergeIntegration?.enabled && ctx.conciergeIntegration.meta
    ? {
      ...withConstitution,
      conciergeExperience: ctx.conciergeIntegration.meta,
      conciergeRecommendation: ctx.conciergeIntegration.recommendation,
    }
    : withConstitution
  const withAlphaAssembly = ctx.alphaTravelerAssembly
    ? {
      ...withConcierge,
      alphaTravelerExperience: {
        ...ctx.alphaTravelerAssembly.meta,
        experience: ctx.alphaTravelerAssembly.experience,
      },
    }
    : withConcierge
  const withBookingAssistant = ctx.bookingAssistantAssembly
    ? {
      ...withAlphaAssembly,
      bookingAssistant: {
        ...ctx.bookingAssistantAssembly.meta,
        experience: ctx.bookingAssistantAssembly.experience,
      },
    }
    : withAlphaAssembly
  const withExecution = ctx.bookingExecutionResult
    ? { ...withBookingAssistant, bookingExecution: toMetaBookingExecution(ctx.bookingExecutionResult) }
    : withBookingAssistant
  const withPayments = ctx.paymentsResult
    ? { ...withExecution, payments: toMetaPayments(ctx.paymentsResult) }
    : withExecution
  const enriched = attachExecutivePlatform(
    ctx,
    attachTravelExecutive(
      ctx,
      attachRahhalBrain(ctx, attachClarification(ctx, attachReasoning(ctx, attachBrain(ctx, withPayments)))),
    ),
  )
  const spokenText = enriched.spokenText?.trim()
    || (reply ? reply.trim().slice(0, 360) : undefined)
  if (!spokenText) return enriched
  return {
    ...enriched,
    spokenText,
    voicePhase: enriched.voicePhase ?? 'final',
  }
}
