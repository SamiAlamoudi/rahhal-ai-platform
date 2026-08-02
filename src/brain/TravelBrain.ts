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
    const snap = this.conversation.ingestTurn({ text, locale })
    const refs = this.context.resolve(text, snap.shortTerm, snap.draft)
    const draft = this.context.applyResolutions(snap.draft, refs)
    const intent = this.conversation.intents.recognize(text)
    const safety = this.safety.assess({
      text,
      intentId: intent.id,
      intentConfidence: intent.confidence,
      draft,
    })
    const reasoner = this.reasoner.reason(draft)
    const decision = this.decision.decide({
      intentId: intent.id,
      intentConfidence: intent.confidence,
      safety,
      reasoner,
    })

    const ranked = this.recommendations.rankFlights(draft, this.conversation.preferences.getProfile())
    const optionIds = ranked.slice(0, 3).map((r) => r.item.id)
    this.conversation.memory.updateShortTerm(snap.travelSession.id, {
      ...snap.shortTerm,
      activeDraft: draft,
      lastMentionedOptions: optionIds,
    })

    const body =
      decision.action === 'route_tool'
        ? `I selected ${decision.toolRoute?.toolId} (mock catalog only). Top option score ${ranked[0]?.score.toFixed(2) ?? 'n/a'}.`
        : safety.message

    const reply = this.personality.shape({
      locale: locale ?? intent.locale,
      intentLabel: this.personality.intentLabel(intent.id, locale ?? intent.locale),
      body,
      safetyMessage: decision.action === 'route_tool' ? undefined : safety.message,
    }).text

    return {
      intentId: intent.id,
      decisionAction: decision.action,
      toolId: decision.toolRoute?.toolId ?? null,
      reply,
      feasible: reasoner.overallFeasible,
    }
  }
}

export function createTravelBrain(): TravelBrain {
  return new TravelBrain()
}
