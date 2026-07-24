import { buildConciergeRecommendations } from '../../../concierge/recommendationBridge'
import {
  buildPlanningDraft,
  canBuildPlanningDraft,
  planningDraftToInsightLines,
} from '../../planningDraft'
import { buildTravelFacts } from '../../conversationBrain'
import { withTripPlan, type AgentProviderMeta } from '../../types'
import type { TravelAgentTurnResult } from '../../travelAgentService'
import { attachTurnMeta } from '../attachTurnMeta'
import type { PlanTurnContext, PlanTurnDeps } from '../context'
import {
  mapConciergeObjective,
  speakTravelFacts,
  toMetaConcierge,
} from '../helpers'

export async function concierge(
  ctx: PlanTurnContext,
  deps: PlanTurnDeps,
): Promise<TravelAgentTurnResult | null> {
  // Concierge sits above the agent: consultant dialogue or agent handoff.
  // It never selects providers — only whether the agent should execute.
  if (deps.isConciergeEnabled() && deps.conciergeService) {
    const conciergeResult = deps.conciergeService.runTurn({
      locale: ctx.memory.locale,
      memory: ctx.memory,
      userText: ctx.userText,
      intent: ctx.extracted.intent,
      requirements: ctx.memory.requirements,
      missingFields: ctx.memory.missingFields,
      previous: ctx.conciergeState,
    })
    ctx.conciergeState = conciergeResult.state

    if (!conciergeResult.handoff.shouldExecuteAgent) {
      // Experience Sprint 2 — Concierge decides policy/facts only; LLM writes the reply.
      ctx.memory = withTripPlan({ ...ctx.memory, phase: 'collecting' }, ctx.memory.tripPlan)
      let optionHints: string[] | undefined
      const decisionBrief = conciergeResult.decision.valueBrief
      if (decisionBrief && decisionBrief.length > 0) {
        optionHints = decisionBrief
      } else if (
        conciergeResult.decision.action === 'propose_options'
        || conciergeResult.decision.action === 'advise'
      ) {
        const recs = buildConciergeRecommendations({
          locale: ctx.memory.locale,
          requirements: ctx.memory.requirements,
          softSignals: conciergeResult.decision.state.softSignals,
        })
        optionHints = recs.optionLines
      }
      // Planning Draft — deterministic estimates for Conversation Brain (not TripPlan).
      const planningDraft = canBuildPlanningDraft(ctx.memory.requirements)
        ? buildPlanningDraft({
          requirements: ctx.memory.requirements,
          locale: ctx.memory.locale,
        })
        : null

      const valueNotes: string[] = []
      if (planningDraft) {
        const insightLines = planningDraftToInsightLines(planningDraft, ctx.memory.locale)
        // Prefer draft ranking + city why-lines as option hints when we have estimates.
        optionHints = [
          ...planningDraft.cities.slice(0, 3).map((city) => `${city.name} — ${city.why}`),
          ...insightLines.slice(1, 3),
        ]
        valueNotes.push(planningDraft.rankingNote)
        if (conciergeResult.decision.preferenceQuestion) {
          valueNotes.push(conciergeResult.decision.preferenceQuestion)
        }
      } else {
        for (const row of [
          conciergeResult.decision.framingNote,
          conciergeResult.decision.preferenceQuestion,
        ]) {
          if (row && row.trim()) valueNotes.push(row)
        }
      }

      const facts = buildTravelFacts({
        memory: ctx.memory,
        objective: mapConciergeObjective(conciergeResult.decision.action),
        // Value-first turns leave askFields empty on purpose — do not fall back to
        // the full missingFields census (that recreates form interrogation).
        missingSlots: (conciergeResult.decision.askFields ?? []).map(String),
        softSignals: conciergeResult.decision.state.softSignals as unknown as Record<string, unknown>,
        heardSummary: conciergeResult.decision.state.heardSummary,
        optionHints,
        recommendations: valueNotes.length > 0 ? valueNotes : undefined,
        planningDraft,
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
        concierge: toMetaConcierge(ctx.conciergeState),
        ...(planningDraft
          ? {
            planningDraft: {
              destination: planningDraft.destination,
              rankedCities: planningDraft.rankedCities,
              durationDays: planningDraft.durationDays,
              recommendedDurationDays: planningDraft.recommendedDurationDays,
              travelerCount: planningDraft.travelerCount,
              budgetAmount: planningDraft.budgetAmount,
              budgetCurrency: planningDraft.budgetCurrency,
              confidence: planningDraft.confidence,
              confidenceScore: planningDraft.confidenceScore,
              breakdown: planningDraft.breakdown,
              missingAssumptions: planningDraft.missingAssumptions,
              rankingNote: planningDraft.rankingNote,
            },
          }
          : {}),
      }
      return {
        reply: spoken.displayText,
        memory: ctx.memory,
        tripPlan: ctx.memory.tripPlan,
        meta: attachTurnMeta(ctx, meta, spoken.spokenText),
        toolBatch: null,
      }
    }
  }
  return null
}
