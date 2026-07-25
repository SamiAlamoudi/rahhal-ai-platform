/**
 * Phase 5 — ToolDecisionEngine
 * LLM-style tool routing (deterministic mock). Not hardcoded interview scripts.
 */

import type { ConversationIntentKind, LiveTravelMemory } from '../conversationIntelligence'
import type { ConfidenceLevel, ToolDecision, ToolDecisionKind } from './types'

function level(n: number): ConfidenceLevel {
  if (n >= 0.75) return 'high'
  if (n >= 0.45) return 'medium'
  return 'low'
}

export function decideTools(input: {
  userText: string
  intent: ConversationIntentKind
  memory: LiveTravelMemory
  reasoningConfidence: number
}): ToolDecision {
  const text = input.userText.toLowerCase()
  const mem = input.memory
  const also: ToolDecisionKind[] = []

  // Intent-led routing with memory awareness
  if (input.intent === 'visa_question' || /visa|تأشير/.test(text)) {
    return {
      tool: 'need_visa',
      reason: 'Traveler asked about entry requirements',
      confidence: level(0.86),
      alsoConsider: mem.destination ? ['continue_conversation'] : ['ask_question'],
    }
  }
  if (input.intent === 'weather' || /weather|طقس|typhoon|إعصار/.test(text)) {
    return {
      tool: 'need_weather',
      reason: 'Weather affects packing and day plans',
      confidence: level(0.84),
      alsoConsider: ['continue_conversation'],
    }
  }
  if (input.intent === 'currency' || /currency|عملة|exchange/.test(text)) {
    return {
      tool: 'need_currency',
      reason: 'Currency / FX question',
      confidence: level(0.8),
      alsoConsider: [],
    }
  }
  if (input.intent === 'search_flights' || /flight|طيران|business class/.test(text)) {
    if (!mem.destination) {
      return {
        tool: 'ask_question',
        reason: 'Flight search needs a destination or region',
        confidence: level(0.7),
        alsoConsider: ['continue_conversation'],
      }
    }
    return {
      tool: 'search_flights',
      reason: 'Enough context to compare flights',
      confidence: level(Math.max(0.7, input.reasoningConfidence)),
      alsoConsider: mem.budgetAmount != null ? [] : ['ask_question'],
    }
  }
  if (input.intent === 'search_hotels' || /hotel|فندق|مترو|metro/.test(text)) {
    if (!mem.destination) {
      return {
        tool: 'ask_question',
        reason: 'Hotel search needs a city',
        confidence: level(0.68),
        alsoConsider: ['continue_conversation'],
      }
    }
    return {
      tool: 'search_hotels',
      reason: 'City + stay preferences available or implied',
      confidence: level(0.78),
      alsoConsider: [],
    }
  }
  if (input.intent === 'complete_trip' || mem.destination) {
    if (mem.destination && (mem.monthHint || mem.flexibleDates) && mem.travelers.adults != null) {
      also.push('search_flights', 'search_hotels', 'need_itinerary')
      return {
        tool: 'need_itinerary',
        reason: 'Core trip slots present — shape an itinerary next',
        confidence: level(0.8),
        alsoConsider: also,
      }
    }
    if (!mem.destination && /cold|بارد|أغير جو|اغير جو|somewhere/.test(text)) {
      return {
        tool: 'continue_conversation',
        reason: 'Inspiration mode — recommend before searching',
        confidence: level(0.72),
        alsoConsider: ['ask_question'],
      }
    }
    if (mem.destination && !mem.monthHint && mem.flexibleDates !== true) {
      return {
        tool: 'ask_question',
        reason: 'Month/season changes price and weather materially',
        confidence: level(0.66),
        alsoConsider: ['continue_conversation'],
      }
    }
    return {
      tool: 'continue_conversation',
      reason: 'Gathering consultant context before tools',
      confidence: level(0.6),
      alsoConsider: ['ask_question'],
    }
  }

  if (input.intent === 'travel_inspiration') {
    return {
      tool: 'continue_conversation',
      reason: 'Inspiration first, tools later',
      confidence: level(0.7),
      alsoConsider: [],
    }
  }

  return {
    tool: 'continue_conversation',
    reason: 'Default consultant dialogue',
    confidence: level(input.reasoningConfidence),
    alsoConsider: [],
  }
}

export const ToolDecisionEngine = {
  decide: decideTools,
}
