import { ContextManager, createConversationContext } from './contextManager'
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
}

/**
 * ConversationOrchestrator — production turn pipeline (no LLM).
 *
 * User → Intent → Extract → Memory → Missing → Plan → Structured response
 */
export function ConversationOrchestrator(options: ConversationOrchestratorOptions = {}) {
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
    })
    contextManager.setMissing(missingFields)

    const ask = nextFieldToAsk(missingFields)
    if (ask) {
      contextManager.setMemory(memoryManager.markAsked([ask]))
    }

    const context = contextManager.get()
    const travelPlan = TravelPlanner({
      intent: classification.intent,
      context,
      hasMissing: missingFields.length > 0,
    })
    const plan = ResponsePlanner({
      context,
      classification,
      missingFields,
      travelPlan,
    })

    // Structured assistant summary only — not a fabricated natural-language reply.
    contextManager.appendAssistant(plan.summary, classification.intent)

    return {
      context: contextManager.get(),
      classification,
      extraction,
      missingFields,
      plan,
    }
  }

  return {
    getContext: () => contextManager.get(),
    setContext: (ctx: ConversationContext) => contextManager.replace(ctx),
    runTurn,
  }
}

export type ConversationOrchestratorHandle = ReturnType<typeof ConversationOrchestrator>
