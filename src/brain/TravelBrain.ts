import { ContextEngine } from './context/ContextEngine'
import { ConversationStateManager } from './conversation/ConversationStateManager'
import { DecisionEngine } from './decision/DecisionEngine'
import { PersonalityLayer } from './personality/PersonalityLayer'
import { TripPlanner } from './planner/TripPlanner'
import { PricingEstimator } from './pricing/PricingEstimator'
import { RecommendationEngine } from './recommendation/RecommendationEngine'
import { TravelReasoner } from './reasoner/TravelReasoner'
import { SafetyLayer } from './safety/SafetyLayer'
import { TimelineBuilder } from './timeline/TimelineBuilder'
import { ToolRouter } from './tool-router/ToolRouter'
import type { LocaleCode } from './types'
import { processBrainTurn } from './turn'

export type FoundationTurnResult = {
  intentId: string
  decisionAction: string
  toolId: string | null
  reply: string
  feasible: boolean
}

/**
 * AI Travel Brain foundation facade.
 * Orchestrates modules in-process with mocks only.
 * Not wired to BrainRouter, UI, or providers.
 */
export class TravelBrain {
  readonly conversation = new ConversationStateManager()
  readonly context = new ContextEngine()
  readonly reasoner = new TravelReasoner()
  readonly recommendations = new RecommendationEngine()
  readonly decision = new DecisionEngine()
  readonly tools = new ToolRouter()
  readonly personality = new PersonalityLayer()
  readonly safety = new SafetyLayer()
  readonly planner = new TripPlanner()
  readonly pricing = new PricingEstimator()
  readonly timeline = new TimelineBuilder()

  async begin(userId: string, locale: LocaleCode = 'ar') {
    return this.conversation.start(userId, locale)
  }

  handleUserText(text: string, locale?: LocaleCode): FoundationTurnResult {
    const trace = processBrainTurn(this, text, locale)
    return {
      intentId: trace.intent.id,
      decisionAction: trace.decision.action,
      toolId: trace.decision.toolRoute?.toolId ?? null,
      reply: trace.reply,
      feasible: trace.reasoner.overallFeasible,
    }
  }

  /** Rich turn for Brain ⇄ UI (mock-only). */
  processTurn(text: string, locale?: LocaleCode) {
    return processBrainTurn(this, text, locale)
  }
}

export function createTravelBrain(): TravelBrain {
  return new TravelBrain()
}
