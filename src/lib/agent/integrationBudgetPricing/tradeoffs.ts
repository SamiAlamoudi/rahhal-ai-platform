/**
 * Integration Sprint 9 — smart budget trade-off explanations.
 */

import { formatMoney } from './currency'
import type { BudgetTradeoff, CostBreakdown, OptimizedBudgetOption } from './types'

export function buildBudgetTradeoffs(input: {
  breakdown: CostBreakdown
  primary: OptimizedBudgetOption | null
  alternatives: OptimizedBudgetOption[]
  flightHoursSaved?: number | null
}): BudgetTradeoff[] {
  const out: BudgetTradeoff[] = []
  const { breakdown, primary, alternatives } = input
  const currency = breakdown.currency

  if (breakdown.overBy > 0) {
    out.push({
      code: 'exceeds_budget',
      titleEn: 'Over budget',
      titleAr: 'تجاوز الميزانية',
      detailEn: `This option exceeds your budget by ${formatMoney(breakdown.overBy, currency)}.`,
      detailAr: `هذا الخيار يتجاوز ميزانيتك بـ ${formatMoney(breakdown.overBy, currency)}.`,
      savingsAmount: null,
      extraCostAmount: breakdown.overBy,
      timeSavedHours: null,
      exceedsBudget: true,
    })
  }

  const cheaperHotel = alternatives.find((a) =>
    a.tier === 'budget' || a.tier === 'best_value')
  if (primary && cheaperHotel && cheaperHotel.breakdown.hotels < primary.breakdown.hotels) {
    const save = primary.breakdown.hotels - cheaperHotel.breakdown.hotels
    out.push({
      code: 'hotel_saves',
      titleEn: 'Hotel savings',
      titleAr: 'توفير في الفندق',
      detailEn: `This hotel tier saves ${formatMoney(save, currency)} versus ${primary.tier}.`,
      detailAr: `هذا مستوى الفندق يوفّر ${formatMoney(save, currency)} مقارنة بـ ${primary.tier}.`,
      savingsAmount: save,
      extraCostAmount: null,
      timeSavedHours: null,
      exceedsBudget: false,
    })
  }

  const premiumFlight = alternatives.find((a) => a.tier === 'premium' || a.tier === 'luxury')
  if (primary && premiumFlight && premiumFlight.breakdown.flights > primary.breakdown.flights) {
    const extra = premiumFlight.breakdown.flights - primary.breakdown.flights
    const hours = input.flightHoursSaved ?? 2
    out.push({
      code: 'flight_time_trade',
      titleEn: 'Flight time trade-off',
      titleAr: 'مقايضة وقت الرحلة',
      detailEn: `This flight costs ${formatMoney(extra, currency)} more but can save ~${hours} hours.`,
      detailAr: `هذه الرحلة تكلف ${formatMoney(extra, currency)} أكثر لكنها قد توفّر نحو ${hours} ساعات.`,
      savingsAmount: null,
      extraCostAmount: extra,
      timeSavedHours: hours,
      exceedsBudget: premiumFlight.breakdown.estimatedTotal > (primary.envelope.total.amount),
    })
  }

  if (breakdown.underBy > 0 && breakdown.withinBudget) {
    out.push({
      code: 'headroom',
      titleEn: 'Budget headroom',
      titleAr: 'هامش ميزانية',
      detailEn: `You still have ~${formatMoney(breakdown.underBy, currency)} of headroom including reserve awareness.`,
      detailAr: `لديك نحو ${formatMoney(breakdown.underBy, currency)} كهامش متبقٍ مع احتساب الاحتياطي.`,
      savingsAmount: breakdown.underBy,
      extraCostAmount: null,
      timeSavedHours: null,
      exceedsBudget: false,
    })
  }

  return out.slice(0, 5)
}
