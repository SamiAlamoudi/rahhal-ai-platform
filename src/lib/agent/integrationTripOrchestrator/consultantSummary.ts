/**
 * Integration Sprint 4 — trip-level consultant narrative (never dump raw JSON).
 */

import type {
  OrchestratorBudgetSplit,
  OrchestratorConflict,
  OrchestratorItinerary,
  OrchestratorRecommendation,
} from './types'

export function buildTripConsultantSummary(input: {
  destination: string
  recommendation: OrchestratorRecommendation | null
  budget: OrchestratorBudgetSplit | null
  itinerary: OrchestratorItinerary | null
  conflicts: OrchestratorConflict[]
  incomplete: boolean
  missingFields: string[]
}): { ar: string; en: string } {
  if (input.incomplete) {
    const askAr = input.missingFields.includes('destination')
      ? 'وين تبي تسافر؟'
      : input.missingFields.includes('dates')
        ? 'متى تبي تسافر؟'
        : 'كم عدد المسافرين؟'
    const askEn = input.missingFields.includes('destination')
      ? 'Where would you like to go?'
      : input.missingFields.includes('dates')
        ? 'When do you want to travel?'
        : 'How many travelers?'
    return {
      ar: `عشان أرتّب لك رحلة كاملة لـ ${input.destination || 'وجهتك'}، ${askAr}`,
      en: `To assemble a complete trip for ${input.destination || 'your destination'}, ${askEn}`,
    }
  }

  const rec = input.recommendation
  if (!rec) {
    const warn = input.conflicts[0]
    return {
      ar: warn?.messageAr ?? `ما قدرت أبني توصية كاملة لـ ${input.destination} الآن.`,
      en: warn?.messageEn ?? `I couldn't build a full recommendation for ${input.destination} right now.`,
    }
  }

  const flightLine = rec.flight
    ? `${String(rec.flight.airline ?? 'Flight')} · ${rec.flight.price ?? '—'} ${rec.currency}`
    : '—'
  const hotelLine = rec.hotel
    ? `${String(rec.hotel.name ?? 'Hotel')} · ${rec.hotel.nightly ?? rec.hotel.total ?? '—'} ${rec.currency}`
    : '—'

  const days = input.itinerary?.days.length ?? 0

  return {
    ar: [
      `رتّبت لك رحلة إلى ${input.destination}:`,
      `الطيران: ${flightLine}. السبب: ${rec.whyFlightAr}`,
      `الفندق: ${hotelLine}. السبب: ${rec.whyHotelAr}`,
      `لماذا هذا الجمع: ${rec.whyComboAr}`,
      input.budget ? `الميزانية: ${input.budget.explanationAr}` : null,
      days > 0 ? `جدول ${days} أيام جاهز (وصول → إقامة → عودة).` : null,
      `مقايضات: ${rec.tradeOffsAr}`,
      'تحب نمضي على هذا الخيار أو نعدّل الميزانية/التواريخ؟',
    ].filter(Boolean).join('\n'),
    en: [
      `I put together a trip to ${input.destination}:`,
      `Flight: ${flightLine}. Why: ${rec.whyFlightEn}`,
      `Hotel: ${hotelLine}. Why: ${rec.whyHotelEn}`,
      `Why this combo: ${rec.whyComboEn}`,
      input.budget ? `Budget: ${input.budget.explanationEn}` : null,
      days > 0 ? `${days}-day outline ready (arrival → stay → return).` : null,
      `Trade-offs: ${rec.tradeOffsEn}`,
      'Shall we proceed with this option, or adjust budget/dates?',
    ].filter(Boolean).join('\n'),
  }
}
