/**
 * Integration Sprint 4 — smart conflict / missing-info detection.
 */

import type { TripRequirements } from '../types'
import type { OrchestratorBudgetSplit, OrchestratorConflict } from './types'

export function detectOrchestratorConflicts(input: {
  requirements: TripRequirements
  budget: OrchestratorBudgetSplit | null
  flight: Record<string, unknown> | null
  hotel: Record<string, unknown> | null
  flightsEmpty: boolean
  hotelsEmpty: boolean
  skipHotels: boolean
}): OrchestratorConflict[] {
  const conflicts: OrchestratorConflict[] = []
  const req = input.requirements

  if (!req.destination && req.destinations.length === 0) {
    conflicts.push({
      code: 'missing_destination',
      severity: 'blocker',
      messageAr: 'ما زلنا نحتاج وجهة واضحة.',
      messageEn: 'We still need a clear destination.',
      suggestionAr: 'قلّي وين تبي تسافر؟',
      suggestionEn: 'Where would you like to go?',
    })
  }

  if (!req.startDate && !req.durationDays) {
    conflicts.push({
      code: 'missing_dates',
      severity: 'warn',
      messageAr: 'التواريخ غير محددة بعد.',
      messageEn: 'Travel dates are not set yet.',
      suggestionAr: 'متى تبي تسافر؟ (أو مدة الرحلة)',
      suggestionEn: 'When do you want to travel (or for how many days)?',
    })
  }

  if (req.startDate && req.endDate && req.startDate > req.endDate) {
    conflicts.push({
      code: 'date_conflict',
      severity: 'blocker',
      messageAr: 'تاريخ العودة قبل المغادرة.',
      messageEn: 'Return date is before departure.',
      suggestionAr: 'نقدر نعدّل التواريخ.',
      suggestionEn: 'We can adjust the dates.',
    })
  }

  if (input.flightsEmpty) {
    conflicts.push({
      code: 'flights_unavailable',
      severity: 'warn',
      messageAr: 'ما لقينا رحلات مناسبة حالياً.',
      messageEn: 'No suitable flights found right now.',
      suggestionAr: 'نجرب تواريخ مرنة أو مطار بديل.',
      suggestionEn: 'We can try flexible dates or an alternate airport.',
    })
  }

  if (!input.skipHotels && input.hotelsEmpty) {
    conflicts.push({
      code: 'hotels_unavailable',
      severity: 'warn',
      messageAr: 'ما لقينا فنادق مناسبة حالياً.',
      messageEn: 'No suitable hotels found right now.',
      suggestionAr: 'نوسّع المنطقة أو نخفض تصنيف النجوم.',
      suggestionEn: 'We can widen the area or lower the star class.',
    })
  }

  if (input.budget && input.flight && input.hotel) {
    const flightPrice = num(input.flight.price)
    const hotelTotal = num(input.hotel.total) ?? (
      num(input.hotel.nightly) != null && num(input.hotel.nights) != null
        ? num(input.hotel.nightly)! * num(input.hotel.nights)!
        : null
    )
    const spent = (flightPrice ?? 0) + (hotelTotal ?? 0)
    if (spent > input.budget.total) {
      conflicts.push({
        code: 'over_budget',
        severity: 'warn',
        messageAr: `المجموع التقريبي ${spent} يتجاوز الميزانية ${input.budget.total} ${input.budget.currency}.`,
        messageEn: `Estimated total ${spent} exceeds budget ${input.budget.total} ${input.budget.currency}.`,
        suggestionAr: 'نقدر نختار خيار أرخص أو نوسّع الميزانية.',
        suggestionEn: 'We can pick cheaper options or raise the budget.',
      })
    } else if (
      (flightPrice != null && flightPrice > input.budget.flights * 1.15)
      || (hotelTotal != null && hotelTotal > input.budget.hotels * 1.15)
    ) {
      conflicts.push({
        code: 'budget_conflict',
        severity: 'info',
        messageAr: 'أحد البنود أعلى من الحصة المقترحة — ما زال ضمن الميزانية الكلية.',
        messageEn: 'One category is above its share — still within the overall budget.',
      })
    }
  }

  return conflicts
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

export function missingOrchestratorFields(requirements: TripRequirements): string[] {
  const missing: string[] = []
  if (!requirements.destination && requirements.destinations.length === 0) missing.push('destination')
  if (!requirements.startDate && !requirements.durationDays) missing.push('dates')
  if (requirements.travelers == null) missing.push('travelers')
  return missing
}
