import {
  buildBookingHistoryConciergeReply,
  findLatestBookingRecord,
  getBookingHistoryUserId,
  getBookingOrchestrator,
  type BookingHistoryIntent,
} from '../../../booking'
import {
  buildConfirmationConciergeReply,
  confirmationStateFromSession,
  type ConfirmationConciergeIntent,
} from '../../../bookingConfirmation'
import {
  buildOrderConciergeReply,
  findManagedOrderBySessionId,
  type OrderConciergeIntent,
} from '../../../orderManagement'
import {
  buildSmartItineraryConciergeReply,
  type SmartItineraryConciergeIntent,
} from '../../../smartItinerary'
import { buildTravelFacts } from '../../conversationBrain'
import { withTripPlan, type AgentProviderMeta } from '../../types'
import type { TravelAgentTurnResult } from '../../travelAgentService'
import { attachTurnMeta } from '../attachTurnMeta'
import type { PlanTurnContext, PlanTurnDeps } from '../context'
import {
  BOOKING_HISTORY_INTENTS,
  CONFIRMATION_INTENTS,
  ORDER_PAYMENT_INTENTS,
  SMART_ITINERARY_INTENTS,
  speakTravelFacts,
} from '../helpers'

export async function earlyIntentRouters(
  ctx: PlanTurnContext,
  deps: PlanTurnDeps,
): Promise<TravelAgentTurnResult | null> {
  // Sprint 45 — open-ended reasoning owns the consultant reply when proposing destinations.
  if (
    !deps.isBrainCoreEnabled()
    && ctx.reasoningResult
    && ctx.reasoningMeta
    && ctx.memory.requirements.destinationFlexible
    && !ctx.memory.requirements.destination
    && ctx.reasoningResult.primary
  ) {
    ctx.memory = withTripPlan({ ...ctx.memory, phase: 'collecting' }, ctx.memory.tripPlan)
    const candidateHints = [
      ctx.reasoningResult.primary
        ? `${ctx.reasoningResult.primary.name}: ${ctx.reasoningResult.primary.whySelected.slice(0, 2).join('; ')}`
        : null,
      ...ctx.reasoningResult.alternatives.slice(0, 3).map(
        (c) => `${c.name}: ${c.whySelected.slice(0, 1).join('')}`,
      ),
    ].filter(Boolean) as string[]
    const facts = buildTravelFacts({
      memory: ctx.memory,
      objective: 'propose_options',
      missingSlots: (ctx.reasoningResult.followUpFields?.length
        ? ctx.reasoningResult.followUpFields
        : ctx.memory.missingFields).map(String),
      optionHints: candidateHints,
      recommendations: [
        ctx.reasoningResult.summary,
        ...ctx.reasoningResult.rationale.slice(0, 4),
      ].filter(Boolean),
      warnings: [
        ...(ctx.reasoningResult.primary?.riskNotes ?? []),
        ...(ctx.reasoningResult.primary?.advisoryNotes ?? []),
      ],
    })
    const spoken = await speakTravelFacts({
      llms: deps.llms,
      conversationId: ctx.input.conversationId,
      messages: ctx.input.messages,
      facts,
      signal: ctx.input.signal,
    })
    const meta: AgentProviderMeta = {
      kind: 'travel_agent',
      version: 2,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      itinerary: ctx.memory.tripPlan,
      spokenText: spoken.spokenText,
      voicePhase: 'final',
      toolResults: [],
    }
    return {
      reply: spoken.displayText,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      meta: attachTurnMeta(ctx, meta, spoken.spokenText),
      toolBatch: null,
    }
  }

  // Sprint 22 — clarification from TripPlanningEngine (shared with voice via runIntegratedBrainTurn).
  if (
    (ctx.tripPlanningOn || ctx.executionOn || ctx.searchOn || ctx.orchestratorOn)
    && ctx.brainMeta?.clarificationQuestion
    && ctx.brainMeta.planning?.stage === 'clarify'
  ) {
    ctx.memory = withTripPlan({ ...ctx.memory, phase: 'collecting' }, ctx.memory.tripPlan)
    const meta: AgentProviderMeta = {
      kind: 'travel_agent',
      version: 2,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      itinerary: ctx.memory.tripPlan,
      toolResults: [],
    }
    {
      const facts = buildTravelFacts({
        memory: ctx.memory,
        objective: 'collect_missing',
        missingSlots: ctx.memory.missingFields.map(String),
        recommendations: [ctx.brainMeta.clarificationQuestion],
      })
      const spoken = await speakTravelFacts({
        llms: deps.llms,
        conversationId: ctx.input.conversationId,
        messages: ctx.input.messages,
        facts,
        signal: ctx.input.signal,
      })
      return {
        reply: spoken.displayText,
        memory: ctx.memory,
        tripPlan: ctx.memory.tripPlan,
        meta: attachTurnMeta(ctx, { ...meta, spokenText: spoken.spokenText, voicePhase: 'final' }, spoken.spokenText),
        toolBatch: null,
      }
    }
  }

  // Sprint 21 — contextual one-question follow-up (text + voice share this path).
  if (
    ctx.travelEngineOn
    && !ctx.tripPlanningOn
    && ctx.brainMeta?.action === 'ask_missing'
    && ctx.brainMeta.contextualReply
  ) {
    ctx.memory = withTripPlan({ ...ctx.memory, phase: 'collecting' }, ctx.memory.tripPlan)
    const meta: AgentProviderMeta = {
      kind: 'travel_agent',
      version: 2,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      itinerary: ctx.memory.tripPlan,
      toolResults: [],
    }
    {
      const facts = buildTravelFacts({
        memory: ctx.memory,
        objective: 'collect_missing',
        missingSlots: ctx.memory.missingFields.map(String),
        recommendations: [ctx.brainMeta.contextualReply],
      })
      const spoken = await speakTravelFacts({
        llms: deps.llms,
        conversationId: ctx.input.conversationId,
        messages: ctx.input.messages,
        facts,
        signal: ctx.input.signal,
      })
      return {
        reply: spoken.displayText,
        memory: ctx.memory,
        tripPlan: ctx.memory.tripPlan,
        meta: attachTurnMeta(ctx, { ...meta, spokenText: spoken.spokenText, voicePhase: 'final' }, spoken.spokenText),
        toolBatch: null,
      }
    }
  }

  // Sprint 17 — smart itinerary intents (above order / confirmation / history).
  if (
    SMART_ITINERARY_INTENTS.has(ctx.extracted.intent)
    && deps.isSmartItineraryEnabled()
  ) {
    const records = await deps.listBookingRecords()
    const latest = findLatestBookingRecord(records)
    const reply = buildSmartItineraryConciergeReply({
      intent: ctx.extracted.intent as SmartItineraryConciergeIntent,
      record: latest,
      locale: ctx.memory.locale,
    })
    const meta: AgentProviderMeta = {
      kind: 'travel_agent',
      version: 2,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      itinerary: ctx.memory.tripPlan,
      toolResults: [],
    }
    return {
      reply,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      meta: attachTurnMeta(ctx, meta, reply),
      toolBatch: null,
    }
  }

  // Sprint 15 — order / payment intents (above confirmation / history).
  // Alpha journey cues continue into Booking Execution + Payments instead.
  if (
    ORDER_PAYMENT_INTENTS.has(ctx.extracted.intent)
    && deps.isOrderManagementEnabled()
    && !ctx.alphaJourneyCue
  ) {
    const records = await deps.listBookingRecords()
    const latest = findLatestBookingRecord(records)
    const customerId = getBookingHistoryUserId() ?? latest?.userId
    const order = latest
      ? findManagedOrderBySessionId(latest.sessionId)
      : null
    const reply = buildOrderConciergeReply(
      ctx.extracted.intent as OrderConciergeIntent,
      {
        bookingSessionId: latest?.sessionId,
        customerId: customerId ?? undefined,
        order,
      },
    )
    const meta: AgentProviderMeta = {
      kind: 'travel_agent',
      version: 2,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      itinerary: ctx.memory.tripPlan,
      toolResults: [],
    }
    return {
      reply,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      meta: attachTurnMeta(ctx, meta),
      toolBatch: null,
    }
  }

  // Sprint 14 — confirmation intents (above history / concierge intake).
  // Alpha journey cues continue into Booking Execution + Payments instead.
  if (
    CONFIRMATION_INTENTS.has(ctx.extracted.intent)
    && deps.isBookingConfirmationEnabled()
    && !ctx.alphaJourneyCue
  ) {
    const records = await deps.listBookingRecords()
    const latest = findLatestBookingRecord(records)
    const session = latest
      ? getBookingOrchestrator().getBookingSession(latest.sessionId)
      : null
    const confirmationState = session ? confirmationStateFromSession(session) : null
    const reply = buildConfirmationConciergeReply({
      intent: ctx.extracted.intent as ConfirmationConciergeIntent,
      state: confirmationState,
      record: latest,
      locale: ctx.memory.locale,
    })
    const meta: AgentProviderMeta = {
      kind: 'travel_agent',
      version: 2,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      itinerary: ctx.memory.tripPlan,
      toolResults: [],
    }
    return {
      reply,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      meta: attachTurnMeta(ctx, meta),
      toolBatch: null,
    }
  }

  // Sprint 13 — booking history intents (above concierge intake; no tools).
  if (
    BOOKING_HISTORY_INTENTS.has(ctx.extracted.intent)
    && deps.isBookingHistoryEnabled()
  ) {
    const records = await deps.listBookingRecords()
    const reply = buildBookingHistoryConciergeReply({
      intent: ctx.extracted.intent as BookingHistoryIntent,
      records,
      locale: ctx.memory.locale,
    })
    const meta: AgentProviderMeta = {
      kind: 'travel_agent',
      version: 2,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      itinerary: ctx.memory.tripPlan,
      toolResults: [],
    }
    return {
      reply,
      memory: ctx.memory,
      tripPlan: ctx.memory.tripPlan,
      meta: attachTurnMeta(ctx, meta),
      toolBatch: null,
    }
  }
  return null
}
