/**
 * Default adapters — delegate to existing production engines (no duplicated logic).
 */

import { extractFromUserText } from '../../agent/extractRequirements'
import { getPreferenceEngine } from '../../ai/preferences'
import {
  isSmartClarificationEnabled,
} from '../../agent/clarification'
import {
  applySmartClarification,
  mergeRequirements,
  missingRequirementFields,
  rebuildMemoryFromMessages,
} from '../../agent/memory'
import {
  applyReasoningToRequirements,
  isPreferenceMemoryEnabled,
  isTravelReasoningEnabled,
  learnPreferencesFromRequirements,
  matchDestinationSelection,
  runTravelReasoning,
  seedRequirementsFromPreferences,
} from '../../agent/reasoning'
import type { AgentMemory, AgentProviderMeta } from '../../agent/types'
import { withTripPlan } from '../../agent/types'
import {
  composeExecutiveDiscoveryReply,
  isTravelExecutiveEnabled,
  processExecutiveIntelligence,
} from '../executive'
import { understandConversation } from './conversationUnderstanding'
import { classifyBrainIntents } from './intentEngine'
import { buildInternalPlan } from './planningEngine'
import { reflectOnResponse } from './reflectionEngine'
import {
  composeBrainResponse,
  composeClarificationQuestion,
} from './responseComposer'
import type { RahhalBrainPorts } from './ports'

function isAgentProviderMeta(value: unknown): value is AgentProviderMeta {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return row.kind === 'travel_agent' && !!row.memory
}

export function createDefaultRahhalBrainPorts(): RahhalBrainPorts {
  return {
    understanding: {
      understand: understandConversation,
    },
    intent: {
      classify: classifyBrainIntents,
    },
    memory: {
      seedPreferences(memory, userId) {
        if (!isTravelReasoningEnabled() && !isPreferenceMemoryEnabled()) return memory
        return {
          ...memory,
          requirements: seedRequirementsFromPreferences(memory.requirements, { userId }),
        }
      },
      learnFromRequirements(memory, userId) {
        if (!isTravelReasoningEnabled() && !isPreferenceMemoryEnabled()) return
        learnPreferencesFromRequirements(memory.requirements, { userId })
      },
      resolvePriorDestinationSelection({ userText, memory, messages }) {
        if (!isTravelReasoningEnabled()) return memory
        const priorMeta = [...messages]
          .reverse()
          .map((m) => m.providerMeta)
          .find((meta) => isAgentProviderMeta(meta) && meta.reasoning?.candidateIds?.length)
        const priorReasoning = priorMeta && isAgentProviderMeta(priorMeta)
          ? priorMeta.reasoning
          : undefined
        if (!priorReasoning?.candidateIds?.length) return memory

        const catalogNames = priorReasoning.candidateIds.map((id) => {
          const hit = memory.requirements.destinations.find((d) =>
            d.toLowerCase().includes(id) || id.includes(d.toLowerCase()),
          )
          return {
            id,
            name: hit ?? id.charAt(0).toUpperCase() + id.slice(1),
            nameAr: hit ?? id,
          }
        })
        const selected = matchDestinationSelection(userText, catalogNames)
        if (!selected) return memory
        return {
          ...memory,
          requirements: mergeRequirements(memory.requirements, {
            destination: selected,
            destinations: [selected],
            destinationFlexible: false,
          }),
          lastIntent: 'plan',
        }
      },
    },
    reasoning: {
      shouldRun({ userText, memory, extracted, understanding }) {
        if (!isTravelReasoningEnabled() || !userText.trim() || memory.tripPlan) return false
        if (memory.requirements.destination) return false
        return (
          extracted.intent === 'discover'
          || memory.requirements.destinationFlexible === true
          || understanding.travelContext.discoveryMode
        )
      },
      run: runTravelReasoning,
      applyToMemory(memory, result) {
        return {
          ...memory,
          requirements: applyReasoningToRequirements(memory.requirements, result),
        }
      },
    },
    clarification: {
      apply(memory) {
        if (!isSmartClarificationEnabled()) {
          return { memory }
        }
        const clarified = applySmartClarification(memory.requirements, {
          locale: memory.locale,
          enabled: true,
        })
        const next = { ...memory, requirements: clarified.requirements }
        if (clarified.inferred.length === 0) {
          return { memory: next }
        }
        return {
          memory: next,
          meta: {
            inferredFields: clarified.inferred as string[],
            rationale: clarified.rationale,
          },
        }
      },
      missingFields(memory) {
        return missingRequirementFields(memory.requirements, {
          smart: isSmartClarificationEnabled(),
        })
      },
    },
    planning: {
      buildPlan: buildInternalPlan,
    },
    reflection: {
      reflect: reflectOnResponse,
    },
    response: {
      compose(input) {
        if (
          isTravelExecutiveEnabled()
          && input.reasoningResult
          && input.memory.requirements.destinationFlexible
          && !input.memory.requirements.destination
          && input.reasoningResult.primary
          && input.executiveContext
        ) {
          const body = composeExecutiveDiscoveryReply({
            result: input.reasoningResult,
            requirements: input.memory.requirements,
            context: input.executiveContext,
          })
          const warnings = [
            ...(input.executiveBudgetWarnings ?? []),
            ...(input.reasoningResult.rejected
              .filter((row) => row.budgetFit === 'over')
              .map((row) => input.locale === 'ar'
                ? `${row.nameAr || row.name} تتجاوز الميزانية`
                : `${row.name} exceeds budget`)),
          ]
          return {
            reasoning: input.reasoningResult.rationale.slice(0, 4),
            recommendation: input.reasoningResult.primary.name,
            tradeoffs: [],
            warnings: warnings.slice(0, 4),
            nextStep: input.locale === 'ar'
              ? 'هل تفضّل أن أُحسّن الترتيب للمناظر، الأنشطة، أم التكلفة الإجمالية؟'
              : 'Would you like me to optimize for scenery, activities, or total cost?',
            body,
          }
        }

        return composeBrainResponse(input)
      },
      composeClarification: composeClarificationQuestion,
    },
    executive: {
      process(input) {
        return processExecutiveIntelligence({
          userText: input.userText,
          memory: input.memory,
          understanding: input.understanding,
          intents: input.intents,
          reasoningResult: input.reasoningResult,
          userId: input.userId,
          profile: getPreferenceEngine().getProfile(input.userId),
        })
      },
    },
  }
}

export function buildMemoryFromMessages(
  messages: Array<{ role: string; content: string }>,
  userText: string,
): AgentMemory {
  const prior = rebuildMemoryFromMessages(
    messages.slice(0, -1) as Parameters<typeof rebuildMemoryFromMessages>[0],
  )
  const extracted = extractFromUserText(userText, prior.locale)
  const memory: AgentMemory = {
    ...prior,
    locale: extracted.locale || prior.locale,
    lastIntent: extracted.intent,
    requirements: mergeRequirements(prior.requirements, extracted.patch),
  }
  return withTripPlan(memory, memory.tripPlan ?? memory.itinerary)
}
