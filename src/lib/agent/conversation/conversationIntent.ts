/**
 * Phase 3 Stage 1 — Conversation intent detection (heuristics only).
 * Does not call LLMs or planning engines.
 */

import type { ConversationIntent, ConversationLocale } from './types'

export function detectConversationIntent(
  userText: string,
  options?: {
    locale?: ConversationLocale
    pendingClarification?: string | null
    lastIntent?: ConversationIntent | null
  },
): ConversationIntent {
  const text = userText.trim()
  const lower = text.toLowerCase()
  const locale = options?.locale === 'en' ? 'en' : 'ar'

  if (options?.pendingClarification && text.length > 0) {
    return 'clarification_reply'
  }

  // Continue cues
  if (
    /^(continue|go on|yes|ok|okay|sure|please|نعم|أكمل|كمل|تمام|حسنا|متابعة)/i.test(text)
    || /continue (the |my )?(trip|plan|conversation)|أكمل|كمل المحادثة|تابع/i.test(lower)
  ) {
    return options?.lastIntent && options.lastIntent !== 'clarification_reply'
      ? 'continue_previous'
      : 'continue_previous'
  }

  // Compare destinations
  if (
    /\b(compare|versus|vs\.?|or)\b/i.test(lower)
    || /قارن|مقارنة|ولا|أو/.test(text)
  ) {
    if (
      /\b(japan|paris|bali|dubai|london|italy|spain|turkey|korea|thailand|morocco)\b/i.test(lower)
      || /اليابان|باريس|بالي|دبي|لندن|إيطاليا|إسبانيا|تركيا|كوريا|تايلند|المغرب/.test(text)
    ) {
      return 'compare_destinations'
    }
  }

  // Budget optimization
  if (
    /\b(budget|cheaper|cost|save money|affordable|price)\b/i.test(lower)
    || /ميزانية|أرخص|تكلفة|وفر|سعر/.test(text)
  ) {
    if (
      /\b(optim|reduce|lower|cut|adjust)\b/i.test(lower)
      || /حسّن|خفض|قلل|عدّل/.test(text)
      || /\bbudget\b/i.test(lower)
      || /ميزانية/.test(text)
    ) {
      return 'budget_optimization'
    }
  }

  // Itinerary refinement
  if (
    /\b(itinerary|day \d|refine|adjust (the )?plan|change day|edit trip)\b/i.test(lower)
    || /برنامج|جدول|عدّل اليوم|حسّن الخطة|عدّل الرحلة/.test(text)
  ) {
    return 'itinerary_refinement'
  }

  // Recommendation
  if (
    /\b(recommend|suggestion|what should|best option|which (one|option))\b/i.test(lower)
    || /وصّي|توصية|ماذا تقترح|أفضل خيار|أي خيار/.test(text)
  ) {
    return 'recommendation'
  }

  // Destination discovery
  if (
    /\b(where (should|to)|ideas?|discover|suggest a (place|destination)|open[- ]ended)\b/i.test(lower)
    || /إلى أين|وين أروح|اقتراحات|اكتشف|وجهة جديدة|أفكار سفر/.test(text)
  ) {
    return 'destination_discovery'
  }

  // Trip planning
  if (
    /\b(plan|trip to|book|travel to|vacation|honeymoon|family trip)\b/i.test(lower)
    || /خط[طّ]ة|رحلة إلى|سفر إلى|شهر عسل|رحلة عائلية|خطط/.test(text)
  ) {
    return 'trip_planning'
  }

  // General advice
  if (
    /\b(advice|tips?|visa|weather|safe|when to go)\b/i.test(lower)
    || /نصيحة|نصائح|تأشيرة|طقس|أمان|متى أسافر/.test(text)
  ) {
    return 'general_travel_advice'
  }

  // Short acknowledgements with prior context → continue
  if (text.length < 24 && options?.lastIntent) {
    return 'continue_previous'
  }

  // Default: planning if destination-like tokens, else general advice
  if (
    /\b(japan|paris|bali|dubai|london|italy|spain)\b/i.test(lower)
    || /اليابان|باريس|بالي|دبي|لندن/.test(text)
  ) {
    return 'trip_planning'
  }

  void locale
  return 'general_travel_advice'
}

export const ConversationIntentDetector = {
  detect: detectConversationIntent,
}
