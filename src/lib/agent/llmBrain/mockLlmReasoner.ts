/**
 * Phase 5 — Mock LLM reasoner (primary path when production APIs disabled).
 *
 * Acts as the "LLM-first" brain: dialect-aware entity/intent understanding
 * with richer coverage than pure regex. Phase 4 rules remain fallback only.
 */

import type {
  ConversationIntentKind,
  ExtractedEntities,
  LiveTravelMemory,
  TripPurposeKind,
} from '../conversationIntelligence'
import {
  createEmptyLiveTravelMemory,
  extractEntities as ruleExtractEntities,
  detectConversationIntent as ruleDetectIntent,
  updateLiveTravelMemory,
} from '../conversationIntelligence'
import type { ArabicDialect } from './types'

function emptyEntities(): ExtractedEntities {
  return {
    destination: null,
    cities: [],
    budgetAmount: null,
    currency: null,
    monthHint: null,
    startDate: null,
    endDate: null,
    flexibleDates: null,
    adults: null,
    children: null,
    infants: null,
    purpose: null,
    hotelPreferences: [],
    flightPreferences: [],
    airlines: [],
    seatPreference: null,
    stopoverPreference: null,
    activities: [],
    visaStatus: null,
    passportNationality: null,
    weatherPreference: null,
    specialRequests: [],
    cues: [],
  }
}

/** Dialect-aware entity extraction — LLM-primary mock. */
export function mockLlmExtractEntities(
  userText: string,
  dialect: ArabicDialect,
): ExtractedEntities {
  // Start from rules as a weak prior, then LLM-mock overlays dialect phrases.
  const base = ruleExtractEntities(userText)
  const entities = { ...base, cues: [...base.cues] }
  const t = userText.trim()

  // Destination: "أبي اليابان" / "ودي أغير جو" / cold asks
  if (!entities.destination) {
    if (/اليابان|japan/i.test(t)) {
      entities.destination = 'Japan'
      entities.cities = ['Japan']
      entities.cues.push('llm:destination:Japan')
    } else if (/طوكيو|tokyo/i.test(t)) {
      entities.destination = 'Tokyo'
      entities.cities = ['Tokyo']
      entities.cues.push('llm:destination:Tokyo')
    } else if (/دبي|dubai/i.test(t)) {
      entities.destination = 'Dubai'
      entities.cities = ['Dubai']
    } else if (/بارد|cold|ثلج|أغير جو|اغير جو|ودي أغير/i.test(t)) {
      entities.weatherPreference = entities.weatherPreference ?? 'cold'
      entities.cues.push('llm:weather:cold')
    }
  }

  // Month: "خلها أكتوبر" / "أكتوبر بدل مارس" — prefer explicit correction target
  if (/خلها\s*أكتوبر|خلّها\s*أكتوبر|أكتوبر\s*بدل|اكتوبر\s*بدل|\boctober\b/i.test(t) || /أكتوبر|اكتوبر/i.test(t)) {
    entities.monthHint = 'October'
    entities.cues.push('llm:month:October')
  } else if (!entities.monthHint && /مارس|march/i.test(t)) {
    entities.monthHint = 'March'
    entities.cues.push('llm:month:March')
  }

  // Budget: "ميزانيتي عشرة" / "عشرة آلاف"
  if (entities.budgetAmount == null) {
    if (/ميزانيتي?\s*عشرة|عشرة آلاف|ten thousand|١٠٠٠٠|10000|عشرة\b/i.test(t)) {
      entities.budgetAmount = 10000
      entities.currency = entities.currency ?? 'SAR'
      entities.cues.push('llm:budget:10000')
    } else if (/ميزانيتي?\s*([0-9]+)/i.test(t)) {
      const m = /ميزانيتي?\s*([0-9]+)/i.exec(t)
      if (m?.[1]) {
        entities.budgetAmount = Number(m[1])
        entities.currency = 'SAR'
      }
    }
  }

  // Stopover OK: "مو مشكلة لو ترانزيت"
  if (/مو مشكلة.*ترانزيت|ترانزيت|one stop|stopover/i.test(t)) {
    entities.stopoverPreference = 'flexible'
    entities.flightPreferences = [...entities.flightPreferences, 'one-stop-ok']
    entities.cues.push('llm:stops:flexible')
  }

  // Hotel near metro (mixed)
  if (/hotel.*مترو|فندق.*مترو|قريب من المترو|near (the )?metro/i.test(t)) {
    entities.hotelPreferences = [...entities.hotelPreferences, 'near-metro']
    entities.cues.push('llm:hotel:near-metro')
  }

  // Business class
  if (/business class/i.test(t)) {
    entities.flightPreferences = [...entities.flightPreferences, 'business-class']
    entities.cues.push('llm:cabin:business')
  }

  // Travelers from dialect family cues
  if (entities.adults == null && /مع زوجتي|أنا وزوجتي|with my wife/i.test(t)) {
    entities.adults = 2
  }
  if (entities.adults == null && (dialect === 'egyptian' || dialect === 'levant') && /اتنين|ثنين|زوج/i.test(t)) {
    entities.adults = 2
  }

  // Purpose
  if (!entities.purpose) {
    const purposeMap: Array<[RegExp, TripPurposeKind]> = [
      [/شهر عسل|honeymoon/i, 'honeymoon'],
      [/عائل|family/i, 'family'],
      [/عمل|business/i, 'business'],
      [/مغامر|adventure/i, 'adventure'],
      [/فاخر|luxury/i, 'luxury'],
      [/سياح|leisure|إجازة|اجازة/i, 'leisure'],
    ]
    for (const [re, purpose] of purposeMap) {
      if (re.test(t)) {
        entities.purpose = purpose
        break
      }
    }
  }

  return entities
}

export function mockLlmDetectIntent(
  userText: string,
): { intent: ConversationIntentKind; confidence: number; source: 'llm' } {
  const t = userText.trim()
  // Prefer semantic LLM-mock intents for dialect phrases before rules
  if (/تأشير|visa/i.test(t)) return { intent: 'visa_question', confidence: 0.9, source: 'llm' }
  if (/طقس|weather|typhoon|إعصار/i.test(t)) return { intent: 'weather', confidence: 0.88, source: 'llm' }
  if (/طيران|flight|business class/i.test(t)) return { intent: 'search_flights', confidence: 0.86, source: 'llm' }
  if (/فندق|hotel|مترو/i.test(t)) return { intent: 'search_hotels', confidence: 0.84, source: 'llm' }
  if (/بارد|أغير\s*ال?جو|اغير\s*ال?جو|somewhere cold|ودي أغير|أغير الجو/i.test(t)) {
    return { intent: 'travel_inspiration', confidence: 0.82, source: 'llm' }
  }
  if (/أبي|أبغى|ابغى|بدي|عايز|بغيت|أشتي|اشتي|plan|أريد|رحلة/i.test(t)) {
    return { intent: 'complete_trip', confidence: 0.78, source: 'llm' }
  }
  const fallback = ruleDetectIntent(t)
  return { intent: fallback.intent, confidence: fallback.confidence, source: 'llm' }
}

export function mockLlmUnderstand(input: {
  userText: string
  dialect: ArabicDialect
  priorMemory?: LiveTravelMemory | null
}): {
  intent: ConversationIntentKind
  intentConfidence: number
  entities: ExtractedEntities
  memory: LiveTravelMemory
} {
  const intentResult = mockLlmDetectIntent(input.userText)
  const entities = mockLlmExtractEntities(input.userText, input.dialect)
  // If LLM mock produced nothing useful, fold in pure rules once (fallback assist).
  const mergedEntities =
    entities.cues.length === 0 && !entities.destination
      ? { ...emptyEntities(), ...ruleExtractEntities(input.userText) }
      : entities
  const memory = updateLiveTravelMemory(
    input.priorMemory ?? createEmptyLiveTravelMemory(),
    mergedEntities,
  )
  return {
    intent: intentResult.intent,
    intentConfidence: intentResult.confidence,
    entities: mergedEntities,
    memory,
  }
}

export const MockLlmReasoner = {
  extractEntities: mockLlmExtractEntities,
  detectIntent: mockLlmDetectIntent,
  understand: mockLlmUnderstand,
}
