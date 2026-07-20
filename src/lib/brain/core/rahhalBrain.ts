/**
 * Rahhal Brain Core v1 — central decision orchestrator.
 *
 * Pipeline: Understanding → Intent → Memory → Reasoning → Planning → Decision → Response
 * Existing engines execute; RahhalBrain decides.
 */

import { extractFromUserText } from '../../agent/extractRequirements'
import { mergeRequirements } from '../../agent/memory'
import {
  isPreferenceMemoryEnabled,
  isTravelReasoningEnabled,
  toReasoningSnapshot,
} from '../../agent/reasoning'
import { isSmartClarificationEnabled } from '../../agent/clarification'
import { isTravelExecutiveEnabled } from '../executive/feature'
import {
  isExecutivePlatformEnabled,
  runExecutivePlatform,
} from '../executive/platform'
import { isExecutiveOsEnabled } from '../executive/os/feature'
import {
  gatherLiveIntelligence,
  isRealWorldIntelligenceEnabled,
} from '../intelligence'
import type { LiveIntelligenceSnapshot } from '../intelligence'
import { withTripPlan } from '../../agent/types'
import type { AgentMemory } from '../../agent/types'
import { createDefaultRahhalBrainPorts, buildMemoryFromMessages } from './defaultPorts'
import { selectModulesToExecute } from './pipeline'
import type { RahhalBrainPorts } from './ports'
import type {
  BrainModuleId,
  RahhalBrainTurnInput,
  RahhalBrainTurnResult,
} from './types'

export type RahhalBrainOptions = {
  ports?: RahhalBrainPorts
  reasoningEnabled?: boolean
  clarificationEnabled?: boolean
  preferenceMemoryEnabled?: boolean
  travelExecutiveEnabled?: boolean
  executivePlatformEnabled?: boolean
  executiveOsEnabled?: boolean
  realWorldIntelligenceEnabled?: boolean
}

function flagOrOverride(flag: boolean, override?: boolean): boolean {
  return typeof override === 'boolean' ? override : flag
}

export function RahhalBrain(options: RahhalBrainOptions = {}) {
  const ports = options.ports ?? createDefaultRahhalBrainPorts()

  const isReasoningOn = () =>
    flagOrOverride(isTravelReasoningEnabled(), options.reasoningEnabled)
  const isClarificationOn = () =>
    flagOrOverride(isSmartClarificationEnabled(), options.clarificationEnabled)
  const isPreferenceOn = () =>
    flagOrOverride(isPreferenceMemoryEnabled(), options.preferenceMemoryEnabled)

  const isExecutiveOn = () =>
    flagOrOverride(isTravelExecutiveEnabled(), options.travelExecutiveEnabled)
  const isPlatformOn = () =>
    flagOrOverride(isExecutivePlatformEnabled(), options.executivePlatformEnabled)
  const isOsOn = () =>
    flagOrOverride(isExecutiveOsEnabled(), options.executiveOsEnabled)
  const isLiveOn = () =>
    flagOrOverride(isRealWorldIntelligenceEnabled(), options.realWorldIntelligenceEnabled)

  const runTurn = (input: RahhalBrainTurnInput): RahhalBrainTurnResult => {
    const modulesExecuted: BrainModuleId[] = []
    const userText = input.userText.trim()

    let memory = input.memory
    const extracted = extractFromUserText(userText, memory.locale)
    memory = {
      ...memory,
      locale: extracted.locale || memory.locale,
      lastIntent: extracted.intent,
      requirements: mergeRequirements(memory.requirements, extracted.patch),
    }

    // Step 1 — Conversation Understanding
    const understanding = ports.understanding.understand({
      userText,
      memory,
      extracted,
    })
    modulesExecuted.push('memory')

    // Step 2 — Intent Detection
    const intents = ports.intent.classify({
      userText,
      locale: memory.locale,
      understanding,
      extracted,
    })

    const plannedModules = selectModulesToExecute({
      understanding,
      memory,
      extracted,
      reasoningEnabled: isReasoningOn(),
      clarificationEnabled: isClarificationOn(),
      preferenceMemoryEnabled: isPreferenceOn(),
    })

    // Step 3 — Memory Retrieval
    if (plannedModules.includes('preferences')) {
      memory = ports.memory.seedPreferences(memory, input.userId)
      modulesExecuted.push('preferences')
    }

    memory = ports.memory.resolvePriorDestinationSelection({
      userText,
      memory,
      messages: input.messages,
    })

    // Step 4 — Travel Reasoning
    let reasoningResult = null
    let reasoningMeta: RahhalBrainTurnResult['reasoningMeta']

    if (
      plannedModules.includes('reasoning')
      && ports.reasoning.shouldRun({ userText, memory, extracted, understanding })
    ) {
      reasoningResult = ports.reasoning.run({
        locale: memory.locale,
        requirements: memory.requirements,
        userText,
      })
      memory = ports.reasoning.applyToMemory(memory, reasoningResult)
      reasoningMeta = toReasoningSnapshot(reasoningResult)
      modulesExecuted.push('destination_discovery', 'climate', 'reasoning', 'visa', 'advisory', 'ranking')
      ports.memory.learnFromRequirements(memory, input.userId)
    } else if (
      (isReasoningOn() || isPreferenceOn())
      && hasPlanningPatch(extracted.patch as Record<string, unknown>)
    ) {
      ports.memory.learnFromRequirements(memory, input.userId)
    }

    // Phase 2 — Travel Executive intelligence (context, rejections, optimizer, budget).
    let executiveEnhancement: RahhalBrainTurnResult['executive'] = undefined
    if (isExecutiveOn()) {
      executiveEnhancement = ports.executive.process({
        userText,
        memory,
        understanding,
        intents,
        reasoningResult,
        userId: input.userId,
      })
      if (executiveEnhancement.reasoningResult) {
        reasoningResult = executiveEnhancement.reasoningResult
        reasoningMeta = toReasoningSnapshot(reasoningResult)
        memory = ports.reasoning.applyToMemory(memory, reasoningResult)
      }
      modulesExecuted.push('executive', 'budget')
    }

    // Sprint 51 — Executive Travel Platform (specialized engines via RahhalBrain only).
    // Sprint 52 — Executive OS engines run inside the same platform orchestrator when flagged.
    let executivePlatform: RahhalBrainTurnResult['executivePlatform'] = undefined
    if (isPlatformOn()) {
      executivePlatform = runExecutivePlatform({
        userId: input.userId,
        userText,
        memory,
        understanding,
        intents,
        reasoningResult,
        executiveEnhancement: executiveEnhancement ?? null,
        enabled: true,
        osEnabled: isOsOn(),
      })
      modulesExecuted.push('executive_platform')
      if (executivePlatform.os) {
        modulesExecuted.push('executive_os')
      }
    }

    // Sprint 53 — Real World Intelligence Layer (live signals via RahhalBrain only).
    let liveIntelligence: LiveIntelligenceSnapshot | undefined
    if (isLiveOn()) {
      liveIntelligence = gatherLiveIntelligence({
        userText,
        memory,
        understanding,
        intents,
        enabled: true,
      })
      modulesExecuted.push('live_intelligence')
    }

    // Step 5 — Smart Clarification
    let clarificationMeta: RahhalBrainTurnResult['clarificationMeta']
    if (plannedModules.includes('clarification')) {
      const clarified = ports.clarification.apply(memory)
      memory = clarified.memory
      if (clarified.meta) {
        clarificationMeta = clarified.meta
      }
      modulesExecuted.push('clarification')
    }

    const missingFields = ports.clarification.missingFields(memory)
    memory = {
      ...memory,
      missingFields,
    }
    memory = withTripPlan(memory, memory.tripPlan ?? memory.itinerary)

    // Step 6 — Internal Planning
    const internalPlan = ports.planning.buildPlan({
      understanding,
      intents,
      memory,
      reasoningRan: Boolean(reasoningResult),
    })

    // Step 7 — Decision + Response
    let decision: RahhalBrainTurnResult['decision'] = {
      type: 'continue',
      reflected: false,
    }

    const composed = ports.response.compose({
      locale: memory.locale,
      understanding,
      intents,
      memory,
      reasoningResult,
      missingFields,
      executiveContext: executiveEnhancement?.context,
      executiveBudgetWarnings: executiveEnhancement?.budgetWarnings,
    })

    if (
      composed
      && reasoningResult
      && memory.requirements.destinationFlexible
      && !memory.requirements.destination
      && reasoningResult.primary
    ) {
      const reflected = ports.reflection.reflect({
        draft: composed,
        understanding,
        intents,
        memory,
        reasoningResult,
      })
      decision = {
        type: 'respond',
        reply: reflected.body,
        reflected: true,
      }
      memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
    } else if (
      executivePlatform?.primaryReply
      && executivePlatform.runs.some((run) =>
        run.engineId === 'live_concierge' && run.execution.applied)
    ) {
      // Live concierge owns urgent in-trip replies.
      decision = {
        type: 'respond',
        reply: executivePlatform.primaryReply,
        reflected: true,
      }
      memory = withTripPlan({ ...memory, phase: memory.phase }, memory.tripPlan)
    } else if (!memory.tripPlan && userText) {
      const question = ports.response.composeClarification({
        locale: memory.locale,
        memory,
        missingFields,
        understanding,
      })
      if (question && missingFields.length > 0 && !understanding.travelContext.discoveryMode) {
        const reflected = ports.reflection.reflect({
          draft: {
            reasoning: [],
            recommendation: null,
            tradeoffs: [],
            warnings: [],
            nextStep: question,
            body: question,
          },
          understanding,
          intents,
          memory,
          reasoningResult,
        })
        decision = {
          type: 'clarify',
          reply: reflected.body,
          reflected: true,
        }
        memory = withTripPlan({ ...memory, phase: 'collecting' }, memory.tripPlan)
      }
    }

    if (decision.type === 'respond' && decision.reply && liveIntelligence?.summary) {
      decision = {
        ...decision,
        reply: attachLiveEvidence(decision.reply, liveIntelligence.summary, memory.locale),
      }
    }

    return {
      memory,
      extracted,
      understanding,
      intents,
      internalPlan,
      reasoningResult,
      reasoningMeta,
      clarificationMeta,
      executive: executiveEnhancement,
      executivePlatform,
      liveIntelligence,
      decision,
      meta: {
        understanding,
        intents,
        internalPlan,
        decision: decision.type,
        modulesExecuted: [...new Set([...modulesExecuted, ...plannedModules])],
        reflected: decision.reflected,
      },
    }
  }

  return { runTurn }
}

function attachLiveEvidence(reply: string, summary: string, locale: 'ar' | 'en'): string {
  if (reply.includes(summary)) return reply
  const header = locale === 'ar' ? 'إشارات حية:' : 'Live signals:'
  return `${reply}\n\n${header}\n${summary}`
}

export type RahhalBrainHandle = ReturnType<typeof RahhalBrain>

export function runRahhalBrainTurn(
  input: Omit<RahhalBrainTurnInput, 'memory'> & {
    messages: RahhalBrainTurnInput['messages']
    userText: string
    memory?: AgentMemory
  },
  options?: RahhalBrainOptions,
): RahhalBrainTurnResult {
  const userText = input.userText.trim()
  const memory = input.memory ?? buildMemoryFromMessages(input.messages, userText)
  return RahhalBrain(options).runTurn({
    ...input,
    userText,
    memory,
  })
}

function hasPlanningPatch(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => {
    if (key === 'regenerateDay') return false
    const value = patch[key]
    if (Array.isArray(value)) return value.length > 0
    return value != null && value !== ''
  })
}
