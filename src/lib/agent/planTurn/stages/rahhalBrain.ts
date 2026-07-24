import { buildTravelFacts } from '../../conversationBrain'
import { applySmartClarification } from '../../memory'
import {
  mergeRequirements,
  missingRequirementFields,
} from '../../memory'
import { withTripPlan, type AgentProviderMeta } from '../../types'
import {
  applyReasoningToRequirements,
  isPreferenceMemoryEnabled,
  learnPreferencesFromRequirements,
  matchDestinationSelection,
  runTravelReasoning,
  seedRequirementsFromPreferences,
  toReasoningSnapshot,
} from '../../reasoning'
import type { TravelAgentTurnResult } from '../../travelAgentService'
import { runRahhalBrainTurn } from '../../../brain/core'
import type { PlanTurnContext, PlanTurnDeps } from '../context'
import {
  hasPlanningPatch,
  speakTravelFacts,
  toMetaExecutiveOs,
  toMetaExecutivePlatform,
  toMetaLiveIntelligence,
  toMetaRahhalBrain,
  toMetaTravelExecutive,
} from '../helpers'

export async function rahhalBrain(
  ctx: PlanTurnContext,
  deps: PlanTurnDeps,
): Promise<TravelAgentTurnResult | null> {
  if (deps.isBrainCoreEnabled()) {
    const brainTurn = runRahhalBrainTurn(
      {
        conversationId: ctx.input.conversationId,
        userText: ctx.userText,
        messages: ctx.input.messages,
        memory: ctx.memory,
        userId: ctx.preferenceUserId,
      },
      {
        reasoningEnabled: deps.options.travelReasoningEnabled,
        clarificationEnabled: deps.options.smartClarificationEnabled,
        travelExecutiveEnabled: deps.options.travelExecutiveEnabled,
      },
    )
    ctx.memory = brainTurn.memory
    ctx.extracted = brainTurn.extracted
    ctx.reasoningResult = brainTurn.reasoningResult
    ctx.reasoningMeta = brainTurn.reasoningMeta
    ctx.clarificationMeta = brainTurn.clarificationMeta
    ctx.rahhalBrainMeta = brainTurn.meta
    ctx.travelExecutiveSnapshot = brainTurn.executive
    ctx.executivePlatformSnapshot = brainTurn.executivePlatform
    ctx.liveIntelligenceSnapshot = brainTurn.liveIntelligence

    if (
      brainTurn.decision.type === 'respond'
      && brainTurn.decision.reply
    ) {
      const facts = buildTravelFacts({
        memory: ctx.memory,
        objective: 'general',
        missingSlots: ctx.memory.missingFields.map(String),
        recommendations: [brainTurn.decision.reply],
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
        reasoning: ctx.reasoningMeta,
        clarification: ctx.clarificationMeta,
        rahhalBrain: toMetaRahhalBrain(brainTurn.meta),
        travelExecutive: brainTurn.executive
          ? toMetaTravelExecutive(brainTurn.executive)
          : undefined,
        executivePlatform: brainTurn.executivePlatform
          ? toMetaExecutivePlatform(brainTurn.executivePlatform)
          : undefined,
        executiveOs: brainTurn.executivePlatform
          ? toMetaExecutiveOs(brainTurn.executivePlatform)
          : undefined,
        liveIntelligence: brainTurn.liveIntelligence
          ? toMetaLiveIntelligence(brainTurn.liveIntelligence)
          : undefined,
      }
      return {
        reply: spoken.displayText,
        memory: ctx.memory,
        tripPlan: ctx.memory.tripPlan,
        meta,
        toolBatch: null,
      }
    }
    // 'clarify' is intentionally NOT an early-return here:
    // downstream intent routers (booking history, order, confirmation, itinerary, brain flags)
    // must still run. The clarify reply flows through the normal attach/return paths below.
  } else {
    // Sprint 45/48 — seed empty slots from long-term preference memory (never overwrite).
    if (isPreferenceMemoryEnabled() || deps.isReasoningEnabled()) {
      ctx.memory = {
        ...ctx.memory,
        requirements: seedRequirementsFromPreferences(ctx.memory.requirements, {
          userId: ctx.preferenceUserId,
        }),
      }
    }

    if (deps.isReasoningEnabled()) {
      // Confirm a previously proposed destination ("first one" / named pick).
      const priorMeta = [...ctx.input.messages]
        .reverse()
        .map((m) => m.providerMeta)
        .find((meta) => meta && typeof meta === 'object' && 'reasoning' in meta && meta.reasoning)
      const priorReasoning = priorMeta && typeof priorMeta === 'object'
        ? (priorMeta as { reasoning?: AgentProviderMeta['reasoning'] }).reasoning
        : undefined
      if (priorReasoning?.candidateIds?.length && !ctx.extracted.patch.destination) {
        const catalogNames = priorReasoning.candidateIds.map((id) => {
          const hit = ctx.memory.requirements.destinations.find((d) =>
            d.toLowerCase().includes(id) || id.includes(d.toLowerCase()),
          )
          return {
            id,
            name: hit ?? id.charAt(0).toUpperCase() + id.slice(1),
            nameAr: hit ?? id,
          }
        })
        const selected = matchDestinationSelection(ctx.userText, catalogNames)
        if (selected) {
          ctx.memory = {
            ...ctx.memory,
            requirements: mergeRequirements(ctx.memory.requirements, {
              destination: selected,
              destinations: [selected],
              destinationFlexible: false,
            }),
            lastIntent: 'plan',
          }
        }
      }
    }

    // Sprint 45 — autonomous destination reasoning for open-ended asks.
    if (
      deps.isReasoningEnabled()
      && ctx.userText.trim()
      && !ctx.memory.tripPlan
      && !ctx.memory.requirements.destination
      && (
        ctx.extracted.intent === 'discover'
        || ctx.memory.requirements.destinationFlexible === true
      )
    ) {
      ctx.reasoningResult = runTravelReasoning({
        locale: ctx.memory.locale,
        requirements: ctx.memory.requirements,
        userText: ctx.userText,
      })
      ctx.memory = {
        ...ctx.memory,
        requirements: applyReasoningToRequirements(ctx.memory.requirements, ctx.reasoningResult),
      }
      ctx.reasoningMeta = toReasoningSnapshot(ctx.reasoningResult)
      learnPreferencesFromRequirements(ctx.memory.requirements, { userId: ctx.preferenceUserId })
    } else if (
      (deps.isReasoningEnabled() || isPreferenceMemoryEnabled())
      && hasPlanningPatch(ctx.extracted.patch as Record<string, unknown>)
    ) {
      learnPreferencesFromRequirements(ctx.memory.requirements, { userId: ctx.preferenceUserId })
    }

    // Sprint 46 — never-ask-twice: infer soft preferences before computing missing slots.
    if (deps.isClarificationEnabled()) {
      const clarified = applySmartClarification(ctx.memory.requirements, {
        locale: ctx.memory.locale,
        enabled: true,
      })
      ctx.memory = {
        ...ctx.memory,
        requirements: clarified.requirements,
      }
      if (clarified.inferred.length > 0) {
        ctx.clarificationMeta = {
          inferredFields: clarified.inferred as string[],
          rationale: clarified.rationale,
        }
      }
    }

    ctx.memory.missingFields = missingRequirementFields(ctx.memory.requirements, {
      smart: deps.isClarificationEnabled(),
    })
    ctx.memory = withTripPlan(ctx.memory, ctx.memory.tripPlan ?? ctx.memory.itinerary)
  }
  return null
}
