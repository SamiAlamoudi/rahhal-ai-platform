/**
 * Sprint 32 — FollowUpQuestionEngine
 * Reuses UnifiedTravelPlanner / Memory follow-up helpers — does not invent Q&A logic.
 */

import {
  buildUnifiedFollowUps,
  detectMissingUnifiedFields,
  type UnifiedFollowUpQuestion,
  type UnifiedTravelPlannerContext,
} from '../../brain/unifiedTravel'
import type { ConversationState } from './types'

export class FollowUpQuestionEngine {
  /**
   * Return at most one required follow-up when core slots are missing.
   * Never asks for passport/nationality.
   */
  missingFields(context: UnifiedTravelPlannerContext): string[] {
    return detectMissingUnifiedFields(context)
  }

  shouldAskBeforePlanning(state: ConversationState): boolean {
    const missing = this.missingFields(state.context)
    if (missing.includes('destination')) return true
    // Ask traveler count once when destination is known but not yet confirmed.
    if (state.context.destination && !state.travelersConfirmed) return true
    return false
  }

  nextQuestion(state: ConversationState): UnifiedFollowUpQuestion | null {
    const missing = detectMissingUnifiedFields(state.context)
    if (missing.includes('destination')) {
      return buildUnifiedFollowUps(['destination'], state.locale)[0] ?? null
    }
    if (state.context.destination && !state.travelersConfirmed) {
      return {
        field: 'travelers',
        required: true,
        question:
          state.locale === 'ar' ? 'كم عدد المسافرين؟' : 'How many travelers?',
      }
    }
    const followUps = buildUnifiedFollowUps(missing, state.locale)
    return followUps[0] ?? null
  }
}

export function createFollowUpQuestionEngine(): FollowUpQuestionEngine {
  return new FollowUpQuestionEngine()
}
