import { applyConstitutionToTurn } from '../../constitution'
import { type AgentProviderMeta } from '../../types'
import type { TravelAgentTurnResult } from '../../travelAgentService'
import { attachTurnMeta } from '../attachTurnMeta'
import type { PlanTurnContext, PlanTurnDeps, PresentationHandoff } from '../context'
import {
  speakTravelFacts,
  toMetaConcierge,
  toToolSummaries,
} from '../helpers'

export async function finalSpeak(
  ctx: PlanTurnContext,
  deps: PlanTurnDeps,
  presentation: PresentationHandoff,
): Promise<TravelAgentTurnResult> {
  const spoken = await speakTravelFacts({
    llms: deps.llms,
    conversationId: ctx.input.conversationId,
    messages: ctx.input.messages,
    facts: presentation.facts,
    signal: ctx.input.signal,
  })

  // Sprint 89 — validate traveler-facing reply; keep meta on every interaction.
  const constitutionFinal = applyConstitutionToTurn({
    userText: ctx.userText,
    memory: ctx.memory,
    tripPlan: ctx.memory.tripPlan,
    replyText: spoken.displayText,
    intent: ctx.memory.lastIntent,
    mission: ctx.travelPlannerResult?.travelPurpose ?? ctx.memory.requirements.tripPurpose,
    confidence: presentation.decisionConfidence,
    explanation: {
      why: ctx.autonomousDecisionResult?.recommendations.explanation
        ?? ctx.dynamicPackagesResult?.selected?.explanation?.split('\n')[0]
        ?? presentation.constitutionPreview.snapshot.explanation?.why
        ?? null,
      benefits: presentation.constitutionPreview.snapshot.explanation?.benefits,
      tradeoffs: presentation.constitutionPreview.snapshot.explanation?.tradeoffs,
      confidence: presentation.decisionConfidence,
    },
    alternativeCount: Math.max(
      ctx.dynamicPackagesResult?.ranked.length ?? 0,
      ctx.autonomousDecisionResult ? 2 : 0,
      presentation.constitutionPreview.snapshot.alternativeCount ?? 0,
    ),
    toolHadNoResults: presentation.toolHadNoResults,
    recoveredFromFailures: Boolean(ctx.autonomousSnapshot?.recoveredFromFailures),
    packagesPresent: Boolean(ctx.dynamicPackagesResult?.selected || ctx.dynamicPackagesResult?.ranked.length),
  })
  ctx.constitutionMeta = constitutionFinal.meta

  let displayReply = spoken.displayText
  if (/no results|لا توجد نتائج/i.test(displayReply) && !ctx.memory.tripPlan) {
    displayReply = [
      displayReply.replace(/\bno results\b/gi, 'limited matches'),
      '',
      constitutionFinal.recoveryNotes[0]
        ?? 'I am expanding nearby airports, flexible dates, alternative hotels, and other providers for closer options.',
    ].join('\n')
  }

  const meta: AgentProviderMeta = {
    kind: 'travel_agent',
    version: 2,
    memory: ctx.memory,
    tripPlan: ctx.memory.tripPlan,
    itinerary: ctx.memory.tripPlan,
    spokenText: spoken.spokenText,
    voicePhase: 'final',
    toolResults: ctx.toolBatch ? toToolSummaries(ctx.toolBatch.results) : [],
    ...(ctx.conciergeState ? { concierge: toMetaConcierge(ctx.conciergeState) } : {}),
  }

  return {
    reply: displayReply,
    memory: ctx.memory,
    tripPlan: ctx.memory.tripPlan,
    meta: attachTurnMeta(ctx, meta, spoken.spokenText),
    toolBatch: ctx.toolBatch,
  }
}
