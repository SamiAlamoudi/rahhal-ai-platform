/**
 * Integration Sprint 4 — budget split with buffer + consultant explanations.
 */

import { allocateBudget } from '../budgetIntelligence/allocate'
import type { TripRequirements } from '../types'
import type { OrchestratorBudgetSplit } from './types'

export function buildOrchestratorBudget(
  requirements: TripRequirements,
  nights: number,
): OrchestratorBudgetSplit | null {
  const total = requirements.budgetAmount
  if (typeof total !== 'number' || total <= 0) return null

  const currency = (requirements.budgetCurrency ?? 'SAR').toUpperCase()
  const buffer = Math.round(total * 0.08)
  const allocatable = Math.max(0, total - buffer)
  const allocation = allocateBudget({
    total: allocatable,
    currency,
    style: requirements.budgetStyle,
    nights,
    flightsOnly: requirements.packageScope === 'flights_only',
  })

  const style = requirements.budgetStyle ?? 'midrange'
  return {
    total,
    currency,
    flights: allocation.flights,
    hotels: allocation.hotels,
    transportation: allocation.transportation,
    activities: allocation.activities,
    buffer,
    explanationAr: [
      `قسّمت ميزانيتك ${total} ${currency} تقريباً كالتالي:`,
      `طيران ${allocation.flights} · فنادق ${allocation.hotels} · تنقل ${allocation.transportation} · أنشطة ${allocation.activities} · احتياطي ${buffer}.`,
      style === 'luxury'
        ? 'ركزت أكثر على الفندق لأن أسلوبك فاخر.'
        : style === 'budget'
          ? 'حافظت على الطيران والفندق ضمن سقف اقتصادي مع هامش صغير.'
          : 'توزيع متوازن بين الطيران والإقامة مع هامش أمان.',
    ].join(' '),
    explanationEn: [
      `I split your ~${total} ${currency} budget as:`,
      `flights ${allocation.flights} · hotels ${allocation.hotels} · transport ${allocation.transportation} · activities ${allocation.activities} · buffer ${buffer}.`,
      style === 'luxury'
        ? 'I weighted hotels higher for a luxury style.'
        : style === 'budget'
          ? 'I kept flights and hotels lean with a small safety buffer.'
          : 'Balanced split between flights and stays with a contingency buffer.',
    ].join(' '),
  }
}
