import type {
  BrainMemorySlot,
  BrainResponsePlan,
  BookingRequestHint,
  ConversationContext,
  IntentClassification,
  RecommendationHint,
} from './types'
import { nextFieldToAsk } from './missingInformationDetector'
import type { TravelPlanSketch } from './travelPlanner'

const FIELD_PROMPTS: Record<BrainMemorySlot, { ar: string; en: string }> = {
  destination: {
    ar: 'إلى أين تود السفر؟',
    en: 'Where would you like to go?',
  },
  budget: {
    ar: 'ما هي ميزانيتك التقريبية؟',
    en: 'What is your approximate budget?',
  },
  travelDates: {
    ar: 'متى تود السفر وكم مدة الرحلة؟',
    en: 'When do you want to travel, and for how long?',
  },
  travelers: {
    ar: 'كم عدد المسافرين؟',
    en: 'How many travelers?',
  },
  cabinClass: {
    ar: 'ما درجة السفر المفضلة؟',
    en: 'Which cabin class do you prefer?',
  },
  airlinePreferences: {
    ar: 'هل لديك تفضيل لشركة طيران؟',
    en: 'Any airline preference?',
  },
  hotelPreferences: {
    ar: 'ما نوع الإقامة التي تفضلها؟',
    en: 'What kind of stay do you prefer?',
  },
  activities: {
    ar: 'ما الأنشطة التي تهمك؟',
    en: 'Which activities interest you?',
  },
  visaRequirements: {
    ar: 'هل تحتاج مساعدة بشأن التأشيرة؟',
    en: 'Do you need help with visa requirements?',
  },
  conversationLanguage: {
    ar: 'بأي لغة تفضل المتابعة؟',
    en: 'Which language should we continue in?',
  },
  currency: {
    ar: 'بأي عملة تفضل الميزانية؟',
    en: 'Which currency for your budget?',
  },
}

/**
 * ResponsePlanner — structured plan only (no LLM generation / no fake prose replies).
 */
export function ResponsePlanner(input: {
  context: ConversationContext
  classification: IntentClassification
  missingFields: BrainMemorySlot[]
  travelPlan: TravelPlanSketch
}): BrainResponsePlan {
  const locale = input.context.locale
  const intent = input.classification.intent
  const ask = nextFieldToAsk(input.missingFields)

  const bookingRequests: BookingRequestHint[] = []
  if (input.travelPlan.action === 'continue_booking') {
    bookingRequests.push({ kind: 'continue', reason: null })
  } else if (input.travelPlan.action === 'modify_trip') {
    bookingRequests.push({ kind: 'modify', reason: null })
  } else if (input.travelPlan.action === 'cancel_booking') {
    bookingRequests.push({ kind: 'cancel', reason: null })
  }

  const recommendations: RecommendationHint[] = []
  if (input.travelPlan.action === 'recommend' && input.context.memory.destination) {
    recommendations.push({
      topic: input.context.memory.destination,
      reason: 'destination_known',
    })
  }

  const suggestedReplies: string[] = []
  if (ask) {
    suggestedReplies.push(locale === 'ar' ? FIELD_PROMPTS[ask].ar : FIELD_PROMPTS[ask].en)
  }

  const summary =
    ask != null
      ? `need_slot:${ask}`
      : `ready:${input.travelPlan.action}`

  const assistantGoal =
    ask != null
      ? `collect:${ask}`
      : `execute:${input.travelPlan.action}`

  return {
    summary,
    assistantGoal,
    missingFields: input.missingFields,
    action: input.travelPlan.action,
    uiHints: {
      showMemoryPanel: true,
      showIntentChip: true,
      highlightMissing: input.missingFields.slice(0, 3),
      suggestedReplies,
    },
    searchRequests: input.travelPlan.searchRequests,
    bookingRequests,
    recommendations,
    intent,
    confidence: input.classification.confidence,
  }
}
