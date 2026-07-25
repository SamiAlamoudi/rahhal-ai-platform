/**
 * Integration Sprint 5 — destination cost estimation (meals / transport / activities).
 */

import type { TripRequirements } from '../types'
import type { DestinationCostEstimate, DestinationKnowledge } from './types'

export function estimateDestinationCost(
  knowledge: DestinationKnowledge,
  requirements: TripRequirements,
): DestinationCostEstimate {
  const style = requirements.budgetStyle ?? 'midrange'
  const nightlyBase =
    style === 'luxury'
      ? knowledge.dailyBudgetSar.high
      : style === 'budget'
        ? knowledge.dailyBudgetSar.low
        : knowledge.dailyBudgetSar.mid

  const mealsPerDay = Math.round(nightlyBase * (style === 'luxury' ? 0.35 : style === 'budget' ? 0.28 : 0.3))
  const transportPerDay = Math.round(nightlyBase * 0.12)
  const activitiesPerDay = Math.round(nightlyBase * (style === 'luxury' ? 0.25 : 0.18))
  const dailyTotal = mealsPerDay + transportPerDay + activitiesPerDay
  const nights = Math.max(1, (requirements.durationDays ?? 5) - 1)
  const travelers = Math.max(1, requirements.travelers ?? 2)
  const tripTotal = dailyTotal * nights * travelers

  return {
    currency: 'SAR',
    mealsPerDay,
    transportPerDay,
    activitiesPerDay,
    dailyTotal,
    tripTotal,
    nights,
    style,
    explanationEn:
      `Local spend ~${dailyTotal} SAR/person/day (meals ${mealsPerDay}, transport ${transportPerDay}, activities ${activitiesPerDay}) · ~${tripTotal} SAR for ${travelers} travelers × ${nights} nights (excluding flights/hotels).`,
    explanationAr:
      `إنفاق محلي تقريباً ${dailyTotal} ر.س/شخص/يوم (طعام ${mealsPerDay} · تنقل ${transportPerDay} · أنشطة ${activitiesPerDay}) · نحو ${tripTotal} ر.س لـ ${travelers} مسافر × ${nights} ليالٍ (بدون طيران/فندق).`,
  }
}
