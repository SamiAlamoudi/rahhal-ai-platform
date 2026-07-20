/**
 * Sprint 44 — Intent Understanding.
 * Classifies chat intents before response generation.
 * Reuses brain IntentClassifier signals; maps to ChatGPT-style labels.
 * Does not call travel providers.
 */

import { IntentClassifier } from '../../brain/intentClassifier'
import type { ChatGptIntent } from './types'
import { logExperience } from './experienceLogger'

export type IntentUnderstandingResult = {
  intent: ChatGptIntent
  confidence: number
  signals: string[]
}

export function classifyChatIntent(input: {
  userText: string
  locale?: 'ar' | 'en'
  history?: Array<{ role: string; content: string }>
}): IntentUnderstandingResult {
  const started = Date.now()
  const text = input.userText.trim()
  const lower = text.toLowerCase()
  const history = input.history ?? []

  if (isSmallTalk(lower, text)) {
    return finish('small_talk', 0.9, ['greeting'], started)
  }

  if (isFollowUp(lower, history)) {
    return finish('follow_up', 0.82, ['follow_up_cue'], started)
  }

  if (/tool result|from the search|based on (the )?results/i.test(lower)) {
    return finish('tool_result', 0.75, ['tool_result'], started)
  }

  const brain = IntentClassifier({ text, locale: input.locale ?? 'en' })
  const mapped = mapBrainIntent(brain.intent)

  // Destination travel without explicit verb → create_itinerary / general chat nuance.
  if (
    mapped === 'general_chat'
    && /(?:travel to|trip to|visit|أريد السفر|رحلة إلى|go to)\s+/i.test(text)
  ) {
    return finish('create_itinerary', Math.max(0.7, brain.confidence), ['destination_trip'], started)
  }

  if (mapped === 'unknown' && text.length < 2) {
    return finish('unknown', 0.4, ['empty'], started)
  }

  return finish(mapped, brain.confidence, brain.signals, started)
}

function finish(
  intent: ChatGptIntent,
  confidence: number,
  signals: string[],
  started: number,
): IntentUnderstandingResult {
  logExperience({
    stage: 'intent',
    event: 'classified',
    durationMs: Date.now() - started,
    meta: { intent, confidence, signals },
  })
  return { intent, confidence, signals }
}

function mapBrainIntent(intent: string): ChatGptIntent {
  switch (intent) {
    case 'SearchFlights':
      return 'book_flight'
    case 'SearchHotels':
      return 'search_hotels'
    case 'SearchPackages':
    case 'AskRecommendation':
      return 'create_itinerary'
    case 'TravelAdvice':
    case 'PackingAdvice':
      return 'travel_advice'
    case 'VisaQuestion':
      return 'visa_question'
    case 'WeatherQuestion':
      return 'weather'
    case 'BudgetPlanning':
      return 'pricing'
    case 'GeneralConversation':
      return 'general_chat'
    default:
      return 'unknown'
  }
}

function isSmallTalk(lower: string, text: string): boolean {
  return (
    /^(hi|hello|hey|thanks|thank you|ok|okay|cool|great|good morning|good evening|how are you)\b/i.test(lower)
    || /^(مرحبا|السلام|شكرا|تمام|حسنا|أهلا|كيف حالك)/.test(text.trim())
  )
}

function isFollowUp(lower: string, history: Array<{ role: string; content: string }>): boolean {
  if (history.length === 0) return false
  return (
    /^(and|also|what about|how about|make it|cheaper|instead|yes|no|that one|the second)\b/i.test(lower)
    || /^(وكمان|أيضا|وماذا عن|أرخص|بدلا|نعم|لا|الثاني)/.test(lower)
    || (lower.split(/\s+/).length <= 6 && history.some((h) => h.role === 'assistant'))
  )
}
