/**
 * Sprint 85 — Conversation Explainability.
 * Why this question? Why this recommendation? What is still missing?
 */

import type { TravelPlanSlotKey } from '../planning/types'
import type {
  ConversationExplanation,
  ConversationQuestion,
} from './types'

export class ConversationExplainability {
  explain(input: {
    question: ConversationQuestion | null
    recommendation?: string | null
    missing: TravelPlanSlotKey[]
  }): ConversationExplanation {
    const missingList = input.missing.length ? input.missing.join(', ') : 'none'
    return {
      whyQuestionAr: input.question?.whyAr ?? null,
      whyQuestionEn: input.question?.whyEn ?? null,
      whyRecommendationAr: input.recommendation
        ? `اقترحت هذا لأن: ${input.recommendation}`
        : null,
      whyRecommendationEn: input.recommendation
        ? `I suggested this because: ${input.recommendation}`
        : null,
      missingAr: `المعلومات المتبقية: ${missingList === 'none' ? 'لا شيء' : missingList}.`,
      missingEn: `Still missing: ${missingList}.`,
    }
  }
}

export function createConversationExplainability(): ConversationExplainability {
  return new ConversationExplainability()
}
