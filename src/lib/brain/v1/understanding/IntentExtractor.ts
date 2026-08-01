/**
 * Sprint 89 Phase 1 — IntentExtractor (consultant intents).
 * Rule-based, model-agnostic. Wraps/extends foundation IntentDetector mapping.
 * No tools, search, booking, or payment.
 */

import { IntentDetector } from '../IntentDetector'
import type { BrainV1Intent } from '../types'
import type {
  ConsultantIntent,
  IntentExtractorResult,
  UnderstandingConfidence,
} from './types'
import { UNDERSTANDING_CONTRACT_VERSION } from './types'

type ConsultantRule = {
  intent: ConsultantIntent
  patterns: RegExp[]
  confidence: number
  isCorrection?: boolean
  isConfirmation?: boolean
}

const CONSULTANT_RULES: ConsultantRule[] = [
  {
    intent: 'abort',
    patterns: [
      /\bcancel (?:planning|plan|this)\b/,
      /\bstop planning\b/,
      /ألغ\u0650?[يي]? ?التخطيط/,
      /الغاء التخطيط|إلغاء التخطيط|نوقف|وقف التخطيط|الغي التخطيط/,
    ],
    confidence: 0.94,
  },
  {
    intent: 'correct',
    patterns: [
      /\binstead\b/,
      /\bactually\b/,
      /\bmake it\b/,
      /\bchange (?:it |the )?(?:to|destination|dates?|origin|travelers?|adults?)\b/,
      /بدل|صرت أبغى|صرت ابي|مو .+ بدل|غير وجهة|غيّر|غير التاريخ|ليس .+ بل|لا،?\s*مو/,
    ],
    confidence: 0.92,
    isCorrection: true,
  },
  {
    intent: 'confirm',
    patterns: [
      /^(?:yes|ok|okay|sure|confirm|sounds good)\b/i,
      /^(?:نعم|ايوه|أيوه|تمام|موافق|أكد|اوكي|أوكي)\s*[.!؟]?$/i,
    ],
    confidence: 0.9,
    isConfirmation: true,
  },
  {
    intent: 'compare',
    patterns: [
      /\bcompare\b/,
      /\bvs\.?\b/,
      /\bor\b.+\bor\b/,
      /قارن|مقارنة|ولا |أم |او |أو .+ (?:ولا|أم)/,
    ],
    confidence: 0.88,
  },
  {
    intent: 'visa_guidance',
    patterns: [/visa/, /تأشير/, /فيزا/],
    confidence: 0.9,
  },
  {
    intent: 'domain_flight',
    patterns: [
      /\bflights? only\b/,
      /\btickets? only\b/,
      /طيران بس|تذاكر? بس|تذاكر طيران/,
    ],
    confidence: 0.86,
  },
  {
    intent: 'domain_hotel',
    patterns: [/\bhotels? only\b/, /فندق بس|فنادق بس|إقامة بس/],
    confidence: 0.86,
  },
  {
    intent: 'domain_car',
    patterns: [/rental car|rent a car|سيارة إيجار|ايجار سيارة|تأجير سيارة/],
    confidence: 0.85,
  },
  {
    intent: 'domain_activity',
    patterns: [/activities only|فعاليات|وش أسوي|ماذا أفعل في/],
    confidence: 0.8,
  },
  {
    intent: 'refine_trip',
    patterns: [
      /\bmake it\b/,
      /\bfocus on\b/,
      /\badd\b/,
      /خلها|خليها|عدّل|عدل|زود|أضف|كمل/,
    ],
    confidence: 0.82,
  },
  {
    intent: 'explore_destination',
    patterns: [
      /where should i (?:go|travel)/,
      /best (?:place|destination)/,
      /ما عندي وجهة|اقترح لي|وين أفضل|أين أذهب|suggest (?:a )?destination/,
    ],
    confidence: 0.84,
  },
  {
    intent: 'advise',
    patterns: [
      /\badvice\b/,
      /\brecommend\b/,
      /نصيح|انصح|تنصح/,
      /how (?:is|about) (?:the )?weather/,
      /كيف الجو|هل .+ آمن/,
    ],
    confidence: 0.8,
  },
  {
    intent: 'plan_trip',
    patterns: [
      /\btrip to\b/,
      /\btravel to\b/,
      /\bplan (?:a )?trip\b/,
      /أريد رحلة|ابي رحلة|أبغى رحلة|أبي أروح|ابي اروح|ودي أسافر|عايز أروح|رحلة إلى|سفر إلى|إلى المغرب|to morocco/,
    ],
    confidence: 0.87,
  },
  {
    intent: 'small_talk',
    patterns: [/^(?:hello|hi|hey|thanks|thank you)\b/i, /^(?:مرحبا|هلا|السلام|شكرا)/],
    confidence: 0.75,
  },
]

const LEGACY_MAP: Record<ConsultantIntent, BrainV1Intent> = {
  plan_trip: 'flight_search',
  refine_trip: 'booking_modification',
  compare: 'price_comparison',
  advise: 'travel_advice',
  correct: 'booking_modification',
  confirm: 'general_conversation',
  abort: 'cancellation',
  explore_destination: 'travel_advice',
  small_talk: 'general_conversation',
  visa_guidance: 'visa_question',
  domain_flight: 'flight_search',
  domain_hotel: 'hotel_search',
  domain_activity: 'travel_advice',
  domain_car: 'travel_advice',
  unknown: 'unknown',
}

function levelFromScore(score: number): UnderstandingConfidence['level'] {
  if (score >= 0.9) return 'confirmed'
  if (score >= 0.75) return 'high_confidence_inferred'
  if (score >= 0.55) return 'medium_confidence_inferred'
  if (score <= 0) return 'unknown'
  return 'medium_confidence_inferred'
}

export class IntentExtractor {
  private readonly legacy: IntentDetector

  constructor(legacy: IntentDetector = new IntentDetector()) {
    this.legacy = legacy
  }

  extract(text: string): IntentExtractorResult {
    const trimmed = text.trim()
    if (!trimmed) {
      return {
        contractVersion: UNDERSTANDING_CONTRACT_VERSION,
        primaryIntent: 'unknown',
        secondaryIntents: [],
        legacyIntent: 'unknown',
        isCorrection: false,
        isConfirmation: false,
        confidence: { level: 'unknown', score: 0 },
      }
    }

    const hits: ConsultantRule[] = []
    for (const rule of CONSULTANT_RULES) {
      if (rule.patterns.some((p) => p.test(trimmed) || p.test(trimmed.toLowerCase()))) {
        hits.push(rule)
      }
    }

    const legacy = this.legacy.detect(trimmed)

    if (hits.length === 0) {
      const mapped = mapLegacyToConsultant(legacy.intent)
      return {
        contractVersion: UNDERSTANDING_CONTRACT_VERSION,
        primaryIntent: mapped,
        secondaryIntents: legacy.secondary.map(mapLegacyToConsultant).filter((x) => x !== mapped),
        legacyIntent: legacy.intent,
        isCorrection: false,
        isConfirmation: false,
        confidence: {
          level: levelFromScore(legacy.confidence),
          score: legacy.confidence,
        },
      }
    }

    hits.sort((a, b) => b.confidence - a.confidence)
    const primary = hits[0]!
    const secondary = hits.slice(1, 4).map((h) => h.intent)
    // Prefer foundation detector when it is more specific domain search and consultant hit is generic plan_trip.
    let legacyIntent = LEGACY_MAP[primary.intent]
    if (
      primary.intent === 'plan_trip'
      && (legacy.intent === 'hotel_search'
        || legacy.intent === 'family_vacation'
        || legacy.intent === 'business_travel'
        || legacy.intent === 'weekend_trip'
        || legacy.intent === 'multi_city_trip'
        || legacy.intent === 'package_search')
    ) {
      legacyIntent = legacy.intent
    }

    return {
      contractVersion: UNDERSTANDING_CONTRACT_VERSION,
      primaryIntent: primary.intent,
      secondaryIntents: secondary,
      legacyIntent,
      isCorrection: Boolean(primary.isCorrection),
      isConfirmation: Boolean(primary.isConfirmation),
      confidence: {
        level: levelFromScore(primary.confidence),
        score: primary.confidence,
      },
    }
  }
}

function mapLegacyToConsultant(intent: BrainV1Intent): ConsultantIntent {
  switch (intent) {
    case 'visa_question':
      return 'visa_guidance'
    case 'travel_advice':
      return 'advise'
    case 'price_comparison':
      return 'compare'
    case 'cancellation':
      return 'abort'
    case 'booking_modification':
      return 'refine_trip'
    case 'general_conversation':
      return 'small_talk'
    case 'hotel_search':
      return 'domain_hotel'
    case 'flight_search':
    case 'package_search':
    case 'multi_city_trip':
    case 'business_travel':
    case 'family_vacation':
    case 'weekend_trip':
    case 'budget_planning':
      return 'plan_trip'
    case 'price_prediction':
      return 'advise'
    default:
      return 'unknown'
  }
}

export function createIntentExtractor(legacy?: IntentDetector): IntentExtractor {
  return new IntentExtractor(legacy)
}
