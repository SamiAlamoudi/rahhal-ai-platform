import { ContextManager, createConversationContext } from './contextManager'
import { buildTravelDomainBridge } from './domainBridge'
import { IntentClassifier } from './intentClassifier'
import { MemoryManager } from './memoryManager'
import { MissingInformationDetector, nextFieldToAsk } from './missingInformationDetector'
import { RequirementExtractor } from './requirementExtractor'
import { ResponsePlanner } from './responsePlanner'
import { TravelPlanner } from './travelPlanner'
import type {
  BrainLocale,
  BrainTurnInput,
  BrainTurnResult,
  ConversationContext,
} from './types'

export type ConversationOrchestratorOptions = {
  conversationId?: string
  locale?: BrainLocale
  context?: ConversationContext
  /**
   * Sprint 21 — Real Travel Conversation Engine.
   * Enables domain slots, TravelPlan, contextual replies, domain bridge.
   */
  travelEngine?: boolean
}

/**
 * ConversationOrchestrator — production turn pipeline (no LLM).
 *
 * User → Intent → Extract → Memory → Missing → Plan → Structured response
 */
export function ConversationOrchestrator(options: ConversationOrchestratorOptions = {}) {
  const travelEngine = options.travelEngine === true
  const contextManager = ContextManager(
    options.context ??
      createConversationContext(options.conversationId, options.locale ?? 'ar'),
  )
  if (options.locale) contextManager.setLocale(options.locale)

  const runTurn = (input: BrainTurnInput): BrainTurnResult => {
    const text = input.userText.trim()
    if (input.locale) contextManager.setLocale(input.locale)

    const ctxBefore = contextManager.get()
    const classification = IntentClassifier({
      text,
      locale: input.locale ?? ctxBefore.locale,
    })
    const extraction = RequirementExtractor({
      text,
      locale: input.locale ?? ctxBefore.locale,
    })

    const memoryManager = MemoryManager(ctxBefore.memory)
    const memory = memoryManager.updateFromExtraction(extraction.patch)
    contextManager.setMemory(memory)
    contextManager.setIntent(classification.intent)
    contextManager.appendUser(text, classification.intent)

    const missingFields = MissingInformationDetector({
      memory,
      intent: classification.intent,
      domainSlots: travelEngine,
    })
    contextManager.setMissing(missingFields)

    // Ask exactly one field; never ask twice.
    const ask = nextFieldToAsk(missingFields)
    if (ask) {
      contextManager.setMemory(memoryManager.markAsked([ask]))
    }

    const context = contextManager.get()
    const travelPlanSketch = TravelPlanner({
      intent: classification.intent,
      context,
      hasMissing: missingFields.length > 0,
    })
    const plan = ResponsePlanner({
      context,
      classification,
      missingFields,
      travelPlan: travelPlanSketch,
      travelEngine,
    })

    // Structured assistant summary only — not a fabricated natural-language reply.
    // (Contextual reply lives on plan.uiHints when travelEngine is on.)
    contextManager.appendAssistant(plan.summary, classification.intent)

    const domain = travelEngine
      ? buildTravelDomainBridge({ memory: context.memory, plan })
      : null

    return {
      context: contextManager.get(),
      classification,
      extraction,
      missingFields,
      plan,
      domain,
      planning: null,
      execution: null,
    }
  }

  return {
    getContext: () => contextManager.get(),
    setContext: (ctx: ConversationContext) => contextManager.replace(ctx),
    runTurn,
    isTravelEngine: () => travelEngine,
  }
}

export type ConversationOrchestratorHandle = ReturnType<typeof ConversationOrchestrator>
