/**
 * Sprint 78 — conversational intent / purpose cues for the planner.
 */

import type { TravelPurpose, TripType, PlannerTravelerType } from './types'

export interface PlannerIntentSignals {
  travelPurpose: TravelPurpose
  tripType: TripType
  travelerType: PlannerTravelerType
  cues: string[]
}

export function detectPlannerIntent(text: string | null | undefined): PlannerIntentSignals {
  const lower = (text ?? '').toLowerCase()
  const cues: string[] = []
  let travelPurpose: TravelPurpose = 'unknown'
  let tripType: TripType = 'unknown'
  let travelerType: PlannerTravelerType = 'unknown'

  if (/\bconference\b|\bsymposium\b|\bsummit\b|مؤتمر/.test(lower)) {
    travelPurpose = 'conference'
    cues.push('conference')
  } else if (/\bhoneymoon\b|شهر\s*العسل/.test(lower)) {
    travelPurpose = 'honeymoon'
    travelerType = 'couple'
    cues.push('honeymoon')
  } else if (/\bmedical\b|\bsurgery\b|\btreatment\b|علاج|طبي/.test(lower)) {
    travelPurpose = 'medical'
    cues.push('medical')
  } else if (/\bstudy\b|\buniversity\b|\beducation\b|دراسة|جامعة/.test(lower)) {
    travelPurpose = 'education'
    cues.push('education')
  } else if (/\bumrah\b|\bhajj\b|\bpilgrim\b|عمرة|حج/.test(lower)) {
    travelPurpose = 'religious'
    cues.push('religious')
  } else if (/\bluxury\b|فاخر/.test(lower)) {
    travelPurpose = 'luxury'
    cues.push('luxury')
  } else if (/\badventure\b|مغامرة|hiking|safari/.test(lower)) {
    travelPurpose = 'adventure'
    cues.push('adventure')
  } else if (/\bshopping\b|تسوق/.test(lower)) {
    travelPurpose = 'shopping'
    cues.push('shopping')
  } else if (/\bweekend\b|نهاية\s*الأسبوع|نهاية\s*الاسبوع/.test(lower)) {
    travelPurpose = 'weekend'
    tripType = 'weekend_getaway'
    cues.push('weekend')
  } else if (/\bfamily\b|\bchildren\b|\bkids\b|عائلة|أطفال/.test(lower)) {
    travelPurpose = 'family'
    travelerType = 'family'
    cues.push('family')
  } else if (/\bbusiness\b|\bmeeting\b|\bwork\s+trip\b|سفر\s*عمل|اجتماع/.test(lower)) {
    travelPurpose = 'business'
    travelerType = 'business'
    cues.push('business')
  } else if (/\bvacation\b|\bholiday\b|\bleisure\b|إجازة|اجازة|عطلة/.test(lower)) {
    travelPurpose = 'vacation'
    cues.push('vacation')
  }

  if (/\bwife\b|\bhusband\b|\bcouple\b|زوجتي|زوجي/.test(lower) && travelerType === 'unknown') {
    travelerType = 'couple'
    cues.push('couple')
  }
  if (/\bchildren\b|\bkids\b|\bson\b|\bdaughter\b|أطفال|اولاد/.test(lower)) {
    travelerType = 'family'
    if (travelPurpose === 'unknown') travelPurpose = 'family'
    cues.push('children')
  }
  if (/\bsolo\b|\balone\b|وحدي/.test(lower)) {
    travelerType = 'solo'
    cues.push('solo')
  }
  if (/\bfriends\b|أصدقاء|اصحاب/.test(lower)) {
    travelerType = 'friends'
    cues.push('friends')
  }

  if (/\bmulti[- ]?city\b|\bmultiple\s+cities\b|عدة\s*مدن/.test(lower)) {
    tripType = 'multi_city'
    cues.push('multi_city')
  } else if (/\bone[- ]?way\b|ذهاب\s*فقط/.test(lower)) {
    tripType = 'one_way'
    cues.push('one_way')
  } else if (/\bround[- ]?trip\b|\breturn\b|ذهاب\s*وإياب|ذهاب\s*وعودة/.test(lower)) {
    tripType = 'round_trip'
    cues.push('round_trip')
  } else if (/\bextended\b|\blong\s+stay\b|إقامة\s*طويلة/.test(lower)) {
    tripType = 'extended_stay'
    cues.push('extended_stay')
  }

  return { travelPurpose, tripType, travelerType, cues }
}
