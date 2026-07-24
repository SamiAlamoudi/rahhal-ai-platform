import { assembleAlphaTravelerExperience } from '../../alphaExperience'
import { assembleBookingAssistant } from '../../bookingAssistant'
import { applyConstitutionToTurn } from '../../constitution'
import { buildTravelFacts } from '../../conversationBrain'
import { integrateConciergeIntoTurn } from '../../conciergeIntegration'
import type { PlanTurnContext, PresentationHandoff } from '../context'
import { offersFromToolBatch, toToolSummaries } from '../helpers'

export function presentation(ctx: PlanTurnContext): PresentationHandoff {
  const toolSummaries = ctx.toolBatch ? toToolSummaries(ctx.toolBatch.results) : undefined
  const toolHadNoResults = (ctx.toolBatch?.results ?? []).some((r) => {
    const err = typeof r.error === 'string' ? r.error : ''
    const summary = typeof r.summary === 'string' ? r.summary : ''
    return /no_results|no (?:flight|hotel) offers|no results/i.test(`${err} ${summary}`)
  })

  const decisionConfidence = ctx.autonomousDecisionResult?.recommendations?.confidence
    ?? ctx.dynamicPackagesResult?.selected?.confidence
    ?? ctx.priceIntelligenceResult?.recommendation.confidence
    ?? 0.78

  // Sprint 97 — integrate ConciergeComposer into conversation response (presentation only).
  ctx.conciergeIntegration = integrateConciergeIntoTurn({
    conversationId: ctx.input.conversationId,
    memory: ctx.memory,
    packageSelected: ctx.dynamicPackagesResult?.selected
      ? {
        id: ctx.dynamicPackagesResult.selected.id,
        title: ctx.dynamicPackagesResult.selected.title,
        totalPrice: ctx.dynamicPackagesResult.selected.totalPrice,
        currency: ctx.dynamicPackagesResult.selected.currency,
        confidence: ctx.dynamicPackagesResult.selected.confidence,
        labels: ctx.dynamicPackagesResult.selected.labels,
        explanation: ctx.dynamicPackagesResult.selected.explanation,
      }
      : null,
    packageRanked: (ctx.dynamicPackagesResult?.ranked ?? []).slice(0, 5).map((p) => ({
      id: p.id,
      title: p.title,
      totalPrice: p.totalPrice,
      currency: p.currency,
      confidence: p.confidence,
      labels: p.labels,
      explanation: p.explanation,
    })),
    decision: ctx.autonomousDecisionResult
      ? {
        explanation: ctx.autonomousDecisionResult.recommendations.explanation,
        confidence: ctx.autonomousDecisionResult.recommendations.confidence,
        bestOverallId: ctx.autonomousDecisionResult.recommendations.bestOverall?.id ?? null,
        bestBudgetId: ctx.autonomousDecisionResult.recommendations.bestBudget?.id ?? null,
        fastestId: ctx.autonomousDecisionResult.recommendations.fastest?.id ?? null,
        bestComfortId: ctx.autonomousDecisionResult.recommendations.bestComfort?.id ?? null,
      }
      : null,
    priceTimingNote: ctx.priceIntelligenceResult?.recommendation.explanation ?? null,
    priceConfidence: ctx.priceIntelligenceResult
      ? ctx.priceIntelligenceResult.recommendation.confidence / 100
      : null,
    engineConfidence: decisionConfidence > 1 ? decisionConfidence / 100 : decisionConfidence,
  })

  // Sprint 99 — assemble unified Alpha traveler experience (presentation only).
  {
    const { flightOffers: alphaFlights, hotelStays: alphaHotels } = offersFromToolBatch(
      ctx.toolBatch ?? undefined,
    )
    ctx.alphaTravelerAssembly = assembleAlphaTravelerExperience({
      conversationId: ctx.input.conversationId,
      memory: ctx.memory,
      conciergeIntegration: ctx.conciergeIntegration,
      packageSelected: ctx.dynamicPackagesResult?.selected
        ? {
          id: ctx.dynamicPackagesResult.selected.id,
          title: ctx.dynamicPackagesResult.selected.title,
          totalPrice: ctx.dynamicPackagesResult.selected.totalPrice,
          currency: ctx.dynamicPackagesResult.selected.currency,
          confidence: ctx.dynamicPackagesResult.selected.confidence,
          explanation: ctx.dynamicPackagesResult.selected.explanation,
          components: ctx.dynamicPackagesResult.selected.components,
        }
        : null,
      flightOffers: alphaFlights.length ? alphaFlights : null,
      hotelOffers: alphaHotels.length ? alphaHotels : null,
      decisionExplanation: ctx.autonomousDecisionResult?.recommendations.explanation ?? null,
      priceTimingNote: ctx.priceIntelligenceResult?.recommendation.explanation ?? null,
      priceConfidence: ctx.priceIntelligenceResult
        ? ctx.priceIntelligenceResult.recommendation.confidence / 100
        : null,
      engineConfidence: decisionConfidence > 1 ? decisionConfidence / 100 : decisionConfidence,
    })
  }

  // Sprint 101 — Smart Booking Assistant after Alpha Experience (presentation only).
  {
    const { flightOffers: bookingFlights, hotelStays: bookingHotels } = offersFromToolBatch(
      ctx.toolBatch ?? undefined,
    )
    const priceRec = ctx.priceIntelligenceResult?.recommendation
    ctx.bookingAssistantAssembly = assembleBookingAssistant({
      conversationId: ctx.input.conversationId,
      memory: ctx.memory,
      alphaExperience: ctx.alphaTravelerAssembly?.experience ?? null,
      packageSelected: ctx.dynamicPackagesResult?.selected
        ? {
          id: ctx.dynamicPackagesResult.selected.id,
          title: ctx.dynamicPackagesResult.selected.title,
          totalPrice: ctx.dynamicPackagesResult.selected.totalPrice,
          currency: ctx.dynamicPackagesResult.selected.currency,
          confidence: ctx.dynamicPackagesResult.selected.confidence,
        }
        : null,
      flightOffers: bookingFlights.length ? bookingFlights : null,
      hotelOffers: bookingHotels.length ? bookingHotels : null,
      priceTimingAction: priceRec?.action ?? null,
      priceOpportunities: priceRec?.opportunities ?? null,
      priceExplanation: priceRec?.explanation ?? null,
      seatsRemaining: typeof bookingFlights[0]?.seatsRemaining === 'number'
        ? bookingFlights[0].seatsRemaining as number
        : typeof bookingFlights[0]?.availableSeats === 'number'
          ? bookingFlights[0].availableSeats as number
          : null,
      roomsRemaining: typeof bookingHotels[0]?.roomsRemaining === 'number'
        ? bookingHotels[0].roomsRemaining as number
        : null,
      visaRequiredSignal: ctx.travelPlannerResult?.riskFlags?.includes('visa_check_required')
        ? true
        : null,
      bookingReadyFromEngine: ctx.bookingIntelligenceResult?.readiness.bookingReady ?? null,
      paymentSessionActive: ctx.paymentsResult
        ? ['pending', 'authorized', 'partially_captured'].includes(ctx.paymentsResult.snapshot.status)
        : null,
      bookingConfirmed: Boolean(
        ctx.bookingExecutionResult
        && ctx.bookingExecutionResult.snapshot.confirmedCount > 0,
      ),
      preferencesApplied: Boolean(ctx.travelerPersonalizationResult || ctx.adaptiveLearningResult),
      engineConfidence: decisionConfidence > 1 ? decisionConfidence / 100 : decisionConfidence,
    })
  }

  const constitutionPreview = applyConstitutionToTurn({
    userText: ctx.userText,
    memory: ctx.memory,
    tripPlan: ctx.memory.tripPlan,
    replyText: '',
    intent: ctx.memory.lastIntent,
    mission: ctx.travelPlannerResult?.travelPurpose ?? ctx.memory.requirements.tripPurpose,
    confidence: decisionConfidence,
    explanation: {
      why: ctx.autonomousDecisionResult?.recommendations.explanation
        ?? ctx.dynamicPackagesResult?.selected?.explanation?.split('\n')[0]
        ?? null,
      benefits: ctx.dynamicPackagesResult?.selected?.reasons?.slice(0, 3),
      tradeoffs: ctx.tripOptimizerResult?.recommendationFacts?.slice(0, 2),
      confidence: decisionConfidence,
    },
    alternativeCount: Math.max(
      ctx.dynamicPackagesResult?.ranked.length ?? 0,
      ctx.autonomousDecisionResult ? 2 : 0,
    ),
    toolHadNoResults,
    recoveredFromFailures: Boolean(ctx.autonomousSnapshot?.recoveredFromFailures),
    packagesPresent: Boolean(ctx.dynamicPackagesResult?.selected || ctx.dynamicPackagesResult?.ranked.length),
  })

  const facts = buildTravelFacts({
    memory: ctx.memory,
    objective: ctx.objective,
    tripPlan: ctx.memory.tripPlan,
    missingSlots: ctx.memory.missingFields.map(String),
    toolResults: toolSummaries,
    savedTitle: ctx.savedTitle,
    recommendations: [
      ...(ctx.travelPlannerResult?.recommendationFacts ?? []),
      ...(ctx.budgetIntelligenceResult?.recommendationFacts ?? []),
      ...(ctx.tripOptimizerResult?.recommendationFacts ?? []),
      ...(ctx.autonomousDecisionResult?.recommendations.explanation
        ? [ctx.autonomousDecisionResult.recommendations.explanation]
        : []),
      ...(ctx.bookingIntelligenceResult?.recommendationFacts ?? []),
      ...(ctx.bookingExecutionResult?.executionFacts ?? []),
      ...(ctx.paymentsResult?.paymentFacts ?? []),
      ...(ctx.dynamicPackagesResult?.selected?.explanation
        ? [ctx.dynamicPackagesResult.selected.explanation]
        : []),
      ...(ctx.conciergeIntegration?.recommendationFacts ?? []),
      ...constitutionPreview.recommendationFacts,
      ...constitutionPreview.recoveryNotes,
    ],
    warnings: ctx.bookingIntelligenceResult && !ctx.bookingIntelligenceResult.readiness.bookingReady
      ? [ctx.bookingIntelligenceResult.readiness.clarification].filter(Boolean) as string[]
      : ctx.budgetIntelligenceResult?.diagnostics.overflow
        ? ['Selected options exceed your stated budget — ask for cheaper alternatives if needed.']
      : ctx.bookingExecutionResult && ctx.bookingExecutionResult.snapshot.failedCount > 0
        ? [`Booking execution failures: ${ctx.bookingExecutionResult.snapshot.failedCount}`]
      : ctx.paymentsResult && ctx.paymentsResult.snapshot.status === 'failed'
        ? [`Payment failed: ${ctx.paymentsResult.session.lastError ?? 'unknown'}`]
        : toolHadNoResults
          ? constitutionPreview.recoveryNotes
        : undefined,
  })
  return {
    facts,
    toolHadNoResults,
    decisionConfidence,
    constitutionPreview,
  }
}
