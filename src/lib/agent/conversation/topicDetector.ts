/**
 * Phase 3 Stage 2 — Conversation topic detection (heuristics only).
 */

import type { ConversationTopic } from './memoryTypes'
import type { ConversationLocale } from './types'

export function detectConversationTopic(
  userText: string,
  options?: {
    locale?: ConversationLocale
    previousTopic?: ConversationTopic | null
  },
): ConversationTopic {
  const text = userText.trim()
  const lower = text.toLowerCase()

  if (
    /\b(visa|passport|entry requirements?)\b/i.test(lower)
    || /تأشيرة|جواز|متطلبات الدخول/.test(text)
  ) {
    return 'visa'
  }

  if (
    /\b(weather|climate|temperature|rainy|season)\b/i.test(lower)
    || /طقس|مناخ|درجة الحرارة|موسم|ممطر/.test(text)
  ) {
    return 'weather'
  }

  if (
    /\b(flight|flights|train|transport|airport|transfer)\b/i.test(lower)
    || /طيران|قطار|مواصلات|مطار|تنقل/.test(text)
  ) {
    return 'transportation'
  }

  if (
    /\b(hotel|hotels|stay|accommodation|resort|airbnb)\b/i.test(lower)
    || /فندق|فنادق|إقامة|منتجع/.test(text)
  ) {
    return 'accommodation'
  }

  if (
    /\b(activit(?:y|ies)|things to do|museum|tour|excursion)\b/i.test(lower)
    || /نشاط|أنشطة|ماذا أفعل|متحف|جولة/.test(text)
  ) {
    return 'activities'
  }

  if (
    /\b(budget|cost|price|affordable|cheaper|expensive)\b/i.test(lower)
    || /ميزانية|تكلفة|سعر|أرخص|غالي/.test(text)
  ) {
    return 'budget_discussion'
  }

  if (
    /\b(recommend|recommendation|suggest|best option)\b/i.test(lower)
    || /وصّي|توصية|اقترح|أفضل خيار/.test(text)
  ) {
    return 'recommendation'
  }

  if (
    /\b(where (should|to)|discover|ideas?|research|destination ideas)\b/i.test(lower)
    || /إلى أين|وين أروح|اكتشف|أفكار|ابحث عن وجهة/.test(text)
  ) {
    return 'destination_research'
  }

  if (
    /\b(plan|trip|itinerary|vacation|honeymoon|travel to)\b/i.test(lower)
    || /خط[طّ]ة|رحلة|برنامج|شهر عسل|سفر/.test(text)
  ) {
    return 'trip_planning'
  }

  if (options?.previousTopic) return options.previousTopic
  void options?.locale
  return 'general_travel'
}

export const TopicDetector = {
  detect: detectConversationTopic,
}
