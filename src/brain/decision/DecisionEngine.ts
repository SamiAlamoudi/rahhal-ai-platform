import type { TravelIntentId } from '../intent/intents'
import type { ReasonerReport } from '../reasoner/TravelReasoner'
import type { SafetyVerdict } from '../safety/SafetyLayer'
import { ToolRouter, type ToolRoute } from '../tool-router/ToolRouter'

export type DecisionInput = {
  intentId: TravelIntentId
  intentConfidence: number
  safety: SafetyVerdict
  reasoner: ReasonerReport
}

export type BrainDecision = {
  action: 'route_tool' | 'clarify' | 'refuse_politely' | 'advise'
  toolRoute: ToolRoute | null
  rationale: string[]
}

/**
 * Chooses which tool should execute — does not execute it.
 */
export class DecisionEngine {
  private readonly router = new ToolRouter()

  decide(input: DecisionInput): BrainDecision {
    const rationale: string[] = []

    if (input.safety.status === 'block') {
      rationale.push(`safety:${input.safety.code}`)
      return {
        action: 'refuse_politely',
        toolRoute: null,
        rationale,
      }
    }

    if (input.safety.status === 'clarify' || input.intentId === 'unknown' || input.intentConfidence < 0.5) {
      rationale.push('needs_clarification')
      const toolRoute = this.router.route('unknown')
      return { action: 'clarify', toolRoute, rationale }
    }

    if (!input.reasoner.overallFeasible && input.intentId.startsWith('book_')) {
      rationale.push('itinerary_not_feasible')
      return {
        action: 'advise',
        toolRoute: this.router.route('travel_advice'),
        rationale,
      }
    }

    const toolRoute = this.router.route(input.intentId)
    rationale.push(`selected:${toolRoute.toolId}`)
    return { action: 'route_tool', toolRoute, rationale }
  }
}
