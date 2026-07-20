/**
 * Step 2 — Intent Engine.
 * Lightweight multi-intent classifier with confidence scoring.
 */

import type { ExtractionResult } from '../../agent/extractRequirements'
import type { AgentLocale } from '../../agent/types'
import type {
  BrainIntent,
  BrainIntentResult,
  ConversationUnderstanding,
  RahhalBrainIntentId,
} from './types'

type IntentRule = {
  id: RahhalBrainIntentId
  weight: number
  patterns: RegExp[]
}

const RULES: IntentRule[] = [
  {
    id: 'destination_discovery',
    weight: 0.93,
    patterns: [
      /\bsomewhere\b|\banywhere\b|\bdon'?t know where\b/i,
      /مكان|وين أروح|وين اروح|ما أعرف وين|ما اعرف وين/,
      /\bsurprise me\b/i,
    ],
  },
  {
    id: 'flight_search',
    weight: 0.91,
    patterns: [/\bflights?\b|\bfly\b|\bairfare\b|طيران|تذكرة|تذاكر/],
  },
  {
    id: 'hotel_search',
    weight: 0.9,
    patterns: [/\bhotels?\b|\bstay\b|\baccommodation\b|فندق|فنادق|إقامة/],
  },
  {
    id: 'visa_inquiry',
    weight: 0.92,
    patterns: [/\bvisa\b|تأشيرة|تاشيرة|فيزا/],
  },
  {
    id: 'budget_optimization',
    weight: 0.88,
    patterns: [/\bbudget\b|\bcost\b|\bhow much\b|ميزانية|كم يكلف|التكلفة/],
  },
  {
    id: 'luxury_travel',
    weight: 0.87,
    patterns: [/\bluxury\b|\b5\s*star\b|\bfirst class\b|فاخر|خمس نجوم|درجة أولى/],
  },
  {
    id: 'family_travel',
    weight: 0.86,
    patterns: [/\bfamily\b|\bkids?\b|\bchildren\b|عائلة|أطفال|اطفال|مع العيال/],
  },
  {
    id: 'business_travel',
    weight: 0.86,
    patterns: [/\bbusiness\b|\bmeeting\b|\bconference\b|عمل|اجتماع|مؤتمر/],
  },
  {
    id: 'weekend_escape',
    weight: 0.85,
    patterns: [/\bweekend\b|عطلة نهاية|نهاية الأسبوع|نهاية الاسبوع/],
  },
  {
    id: 'honeymoon',
    weight: 0.9,
    patterns: [/\bhoneymoon\b|شهر عسل|عسل/],
  },
  {
    id: 'adventure',
    weight: 0.84,
    patterns: [/\badventure\b|\bhiking\b|\bdiving\b|مغامرة|تسلق|غوص/],
  },
  {
    id: 'medical_travel',
    weight: 0.88,
    patterns: [/\bmedical\b|\btreatment\b|\bsurgery\b|علاج|عملية|طبي/],
  },
  {
    id: 'religious_travel',
    weight: 0.9,
    patterns: [/\bumrah\b|\bhajj\b|\bpilgrimage\b|عمرة|حج|زيارة مقدسة/],
  },
  {
    id: 'trip_planning',
    weight: 0.82,
    patterns: [/\bplan\b|\btrip\b|\bitinerary\b|خطط|رحلة|برنامج/],
  },
]

export function classifyBrainIntents(input: {
  userText: string
  locale: AgentLocale
  understanding: ConversationUnderstanding
  extracted: ExtractionResult
}): BrainIntentResult {
  const text = input.userText.trim()
  const lower = text.toLowerCase()
  const hits: BrainIntent[] = []

  for (const rule of RULES) {
    const matched = rule.patterns.filter((p) => p.test(lower) || p.test(text))
    if (matched.length === 0) continue
    hits.push({
      id: rule.id,
      confidence: Math.min(0.99, rule.weight + (matched.length - 1) * 0.02),
      signals: matched.map((p) => p.source.slice(0, 48)),
    })
  }

  if (input.understanding.travelContext.discoveryMode) {
    pushOrBoost(hits, 'destination_discovery', 0.9, ['discovery_context'])
  }
  if (input.understanding.emotionalContext.needsBreak) {
    pushOrBoost(hits, 'trip_planning', 0.78, ['needs_break'])
    pushOrBoost(hits, 'weekend_escape', 0.72, ['needs_break'])
  }
  if (input.understanding.travelContext.climateHint) {
    pushOrBoost(hits, 'destination_discovery', 0.75, ['climate_hint'])
  }
  if (input.extracted.intent === 'discover') {
    pushOrBoost(hits, 'destination_discovery', 0.95, ['agent_discover_intent'])
  }
  if (input.extracted.intent === 'plan') {
    pushOrBoost(hits, 'trip_planning', 0.88, ['agent_plan_intent'])
  }

  hits.sort((a, b) => b.confidence - a.confidence)

  const primary = hits[0] ?? {
    id: 'general_conversation' as RahhalBrainIntentId,
    confidence: 0.4,
    signals: ['fallback'],
  }

  const secondary = hits
    .filter((row) => row.id !== primary.id)
    .slice(0, 4)

  return { primary, secondary }
}

function pushOrBoost(
  hits: BrainIntent[],
  id: RahhalBrainIntentId,
  confidence: number,
  signals: string[],
): void {
  const existing = hits.find((row) => row.id === id)
  if (existing) {
    existing.confidence = Math.max(existing.confidence, confidence)
    existing.signals.push(...signals)
    return
  }
  hits.push({ id, confidence, signals })
}
