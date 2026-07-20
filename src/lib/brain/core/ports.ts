/**
 * Rahhal Brain Core v1 — dependency-inversion ports.
 * RahhalBrain depends on interfaces; adapters delegate to existing engines.
 */

import type { ExtractionResult } from '../../agent/extractRequirements'
import type { AgentMemory, TripRequirements } from '../../agent/types'
import type { TravelReasoningResult } from '../../agent/reasoning/types'
import type { ExecutiveContext, ExecutiveEnhancement } from '../executive/types'
import type {
  BrainIntentResult,
  ComposedResponse,
  ConversationUnderstanding,
  InternalPlan,
  RahhalBrainTurnInput,
} from './types'

export interface ConversationUnderstandingPort {
  understand(input: {
    userText: string
    memory: AgentMemory
    extracted: ExtractionResult
  }): ConversationUnderstanding
}

export interface IntentEnginePort {
  classify(input: {
    userText: string
    locale: AgentMemory['locale']
    understanding: ConversationUnderstanding
    extracted: ExtractionResult
  }): BrainIntentResult
}

export interface MemoryRetrievalPort {
  seedPreferences(memory: AgentMemory, userId: string): AgentMemory
  learnFromRequirements(memory: AgentMemory, userId: string): void
  resolvePriorDestinationSelection(input: {
    userText: string
    memory: AgentMemory
    messages: RahhalBrainTurnInput['messages']
  }): AgentMemory
}

export interface TravelReasoningPort {
  shouldRun(input: {
    userText: string
    memory: AgentMemory
    extracted: ExtractionResult
    understanding: ConversationUnderstanding
  }): boolean
  run(input: {
    locale: AgentMemory['locale']
    requirements: AgentMemory['requirements']
    userText: string
  }): TravelReasoningResult
  applyToMemory(
    memory: AgentMemory,
    result: TravelReasoningResult,
  ): AgentMemory
}

export interface ClarificationPort {
  apply(memory: AgentMemory): {
    memory: AgentMemory
    meta?: { inferredFields: string[]; rationale: string[] }
  }
  missingFields(memory: AgentMemory): Array<keyof TripRequirements>
}

export interface PlanningEnginePort {
  buildPlan(input: {
    understanding: ConversationUnderstanding
    intents: BrainIntentResult
    memory: AgentMemory
    reasoningRan: boolean
  }): InternalPlan
}

export interface ReflectionEnginePort {
  reflect(input: {
    draft: ComposedResponse
    understanding: ConversationUnderstanding
    intents: BrainIntentResult
    memory: AgentMemory
    reasoningResult: TravelReasoningResult | null
  }): ComposedResponse
}

export interface ResponseComposerPort {
  compose(input: {
    locale: AgentMemory['locale']
    understanding: ConversationUnderstanding
    intents: BrainIntentResult
    memory: AgentMemory
    reasoningResult: TravelReasoningResult | null
    missingFields: Array<keyof TripRequirements>
    executiveContext?: ExecutiveContext
    executiveBudgetWarnings?: string[]
  }): ComposedResponse | null
  composeClarification(input: {
    locale: AgentMemory['locale']
    memory: AgentMemory
    missingFields: Array<keyof TripRequirements>
    understanding: ConversationUnderstanding
  }): string | null
}

export interface ExecutivePort {
  process(input: {
    userText: string
    memory: AgentMemory
    understanding: ConversationUnderstanding
    intents: BrainIntentResult
    reasoningResult: TravelReasoningResult | null
    userId: string
  }): ExecutiveEnhancement
}

export interface RahhalBrainPorts {
  understanding: ConversationUnderstandingPort
  intent: IntentEnginePort
  memory: MemoryRetrievalPort
  reasoning: TravelReasoningPort
  clarification: ClarificationPort
  planning: PlanningEnginePort
  reflection: ReflectionEnginePort
  response: ResponseComposerPort
  executive: ExecutivePort
}
