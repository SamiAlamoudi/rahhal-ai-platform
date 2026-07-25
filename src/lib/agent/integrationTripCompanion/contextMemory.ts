/**
 * Integration Sprint 7 — live trip context memory snapshot.
 */

import type { AgentMemory, TripPlan } from '../types'
import type { TravelTimelineSnapshot, TripCompanionContextMemory, TripSessionState } from './types'

export function buildCompanionContextMemory(input: {
  memory: AgentMemory
  plan: TripPlan | null
  sessionState: TripSessionState
  timeline: TravelTimelineSnapshot | null
}): TripCompanionContextMemory {
  const plan = input.plan
  const hotel = plan?.accommodations[0]?.name ?? null
  const city = plan?.destinations[0]
    ?? plan?.requirements.destination
    ?? null
  const today = plan?.dailyItinerary[0] ?? plan?.activities[0] ?? null
  const prefs = [
    ...plan?.interests ?? [],
    ...input.memory.requirements.interests,
    input.memory.requirements.tripPurpose,
    input.memory.requirements.budgetStyle,
  ].filter((v): v is string => Boolean(v))

  const uniquePrefs = [...new Set(prefs)].slice(0, 8)
  const nextTitle = input.timeline?.next?.titleEn
  const currentTitle = input.timeline?.current?.titleEn

  return {
    tripId: plan?.id ?? null,
    currentHotel: hotel,
    currentCity: city,
    todaysPlanSummaryEn: today
      ? `Day ${today.day}: ${today.title}${currentTitle ? ` · now: ${currentTitle}` : ''}${nextTitle ? ` · next: ${nextTitle}` : ''}`
      : (nextTitle ? `Next: ${nextTitle}` : 'No day plan loaded yet.'),
    todaysPlanSummaryAr: today
      ? `اليوم ${today.day}: ${today.title}${currentTitle ? ` · الآن: ${currentTitle}` : ''}${nextTitle ? ` · التالي: ${nextTitle}` : ''}`
      : (nextTitle ? `التالي: ${nextTitle}` : 'لا توجد خطة يومية محمّلة بعد.'),
    preferences: uniquePrefs,
    budgetAmount: plan?.estimatedBudget.amount
      ?? input.memory.requirements.budgetAmount
      ?? null,
    budgetCurrency: plan?.estimatedBudget.currency
      ?? input.memory.requirements.budgetCurrency
      ?? null,
    sessionState: input.sessionState,
  }
}
