/**
 * Step 1 — Conversation Understanding.
 * Surfaces explicit, implicit, and hidden travel intent before any module runs.
 */

import { detectOpenEndedDestination } from '../../agent/reasoning/openEndedDetector'
import type { ExtractionResult } from '../../agent/extractRequirements'
import type { AgentMemory } from '../../agent/types'
import type { ConversationUnderstanding, EmotionalTone } from './types'

const BREAK_PATTERNS = [
  /\bneed a break\b/i,
  /\bburn(?:ed|t)? out\b/i,
  /\bstress(?:ed)?\b/i,
  /محتاج راحة/,
  /تعبت|متعب/,
  /أحتاج إجازة|احتاج اجازة/,
]

const LONG_FLIGHT_CONSTRAINT = [
  /\b(?:wife|husband|partner|spouse).*(?:hate|dislike|avoid).*(?:long|lengthy).*(?:flight|flights|haul)\b/i,
  /(?:زوجتي|زوجي|زوجة).*(?:تكره|ما تحب|لا تحب).*(?:طيران|رحلات).*(?:طويل|طويلة)/,
  /\bno long (?:flights?|haul)\b/i,
  /(?:بدون|ما ابغى|ما أبغى).*(?:طيران طويل|رحلات طويلة)/,
]

const VAGUE_PATTERNS = [
  /\bi don'?t know\b/i,
  /ما أدري|ما ادري|مو متأكد|مش متأكد/,
  /\bsurprise me\b/i,
  /فاجئني|فاجئوني/,
]

export function understandConversation(input: {
  userText: string
  memory: AgentMemory
  extracted: ExtractionResult
}): ConversationUnderstanding {
  const text = input.userText.trim()
  const lower = text.toLowerCase()
  const req = input.memory.requirements
  const open = detectOpenEndedDestination(
    text,
    Boolean(req.destination) && !req.destinationFlexible,
  )

  const implicitRequests: string[] = []
  const hiddenIntents: string[] = []
  const constraints: string[] = []

  if (BREAK_PATTERNS.some((p) => p.test(text) || p.test(lower))) {
    implicitRequests.push('vacation_escape')
    hiddenIntents.push('needs_rest')
  }

  if (open.climateHint || req.weatherPreference) {
    implicitRequests.push('climate_preference')
  }

  if (open.isOpenEnded || req.destinationFlexible || extractedDiscovery(input.extracted)) {
    implicitRequests.push('destination_discovery')
    hiddenIntents.push('discovery_mode')
  }

  if (LONG_FLIGHT_CONSTRAINT.some((p) => p.test(text) || p.test(lower))) {
    constraints.push('avoid_long_flights')
    hiddenIntents.push('flight_duration_constraint')
  }

  if (/\bweekend\b|عطلة نهاية|نهاية الأسبوع/.test(lower) || /نهاية\s*الأسبوع/.test(text)) {
    implicitRequests.push('short_trip')
    hiddenIntents.push('weekend_escape')
  }

  if (/\b(?:wife|husband|kids|children|family)\b/i.test(lower)
    || /(?:زوجتي|زوجي|أطفال|اطفال|عائلة)/.test(text)) {
    implicitRequests.push('travel_party_context')
  }

  const tone = detectTone(text, lower)
  const isVague = VAGUE_PATTERNS.some((p) => p.test(text) || p.test(lower))
    || open.isOpenEnded
    || input.extracted.intent === 'discover'

  return {
    explicitRequest: text,
    implicitRequests: unique(implicitRequests),
    hiddenIntents: unique(hiddenIntents),
    travelContext: {
      hasDestination: Boolean(req.destination),
      discoveryMode: open.isOpenEnded || req.destinationFlexible === true || input.extracted.intent === 'discover',
      climateHint: open.climateHint ?? req.weatherPreference ?? null,
      budgetMentioned: req.budgetAmount != null || req.budgetFlexible === true,
      timeframeMentioned: Boolean(req.startDate || req.endDate || req.durationDays),
      partyMentioned: req.travelers != null || req.travelerType != null,
    },
    emotionalContext: {
      tone,
      needsBreak: implicitRequests.includes('vacation_escape'),
      isVague,
    },
    constraints: unique(constraints),
  }
}

function extractedDiscovery(extracted: ExtractionResult): boolean {
  return extracted.intent === 'discover' || extracted.patch.destinationFlexible === true
}

function detectTone(text: string, lower: string): EmotionalTone {
  if (BREAK_PATTERNS.some((p) => p.test(text) || p.test(lower))) return 'stressed'
  if (/\b(?:excited|can'?t wait|yay)\b/i.test(lower) || /(?:متحمس|ما أطيق|ما اطيق)/.test(text)) {
    return 'excited'
  }
  if (VAGUE_PATTERNS.some((p) => p.test(text) || p.test(lower))) return 'uncertain'
  return 'neutral'
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
