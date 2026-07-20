/**
 * Sprint 52 — Goal Planning detection (shared pure helpers).
 */

import type { ExecutiveEngineContext } from '../platform/engineContract'
import type { TravelGoal } from './types'

export function detectTravelGoal(ctx: ExecutiveEngineContext): TravelGoal {
  const text = `${ctx.userText} ${(ctx.profile.travelStyle.interests ?? []).join(' ')}`.toLowerCase()
  const intents = [ctx.intents.primary.id, ...ctx.intents.secondary.map((row) => row.id)]

  if (intents.includes('honeymoon') || /honeymoon|شهر عسل|anniversary|رومانسي/.test(text)) {
    return 'honeymoon'
  }
  if (intents.includes('family_travel') || /family|kids|أطفال|عائلة/.test(text)) {
    return 'family'
  }
  if (intents.includes('business_travel') || /business|اجتماع|عمل|مؤتمر/.test(text)) {
    return /conference|مؤتمر|summit/.test(text) ? 'conference' : 'business'
  }
  if (intents.includes('adventure') || /adventure|hiking|مغامرة|تسلق/.test(text)) {
    return 'adventure'
  }
  if (intents.includes('medical_travel') || /medical|hospital|علاج|طبي/.test(text)) {
    return 'medical'
  }
  if (intents.includes('religious_travel') || /pilgrim|umrah|hajj|عمرة|حج|زيارة دينية/.test(text)) {
    return 'pilgrimage'
  }
  if (/shop|mall|تسوق|outlet/.test(text)) return 'shopping'
  if (/photo|تصوير|camera/.test(text)) return 'photography'
  if (/food|cuisine|مطعم|طعام|culinary/.test(text)) return 'food'
  if (/relax|spa|beach|استرخاء|شاطئ|هدوء/.test(text)) return 'relaxation'
  if (ctx.profile.travelStyle.style === 'adventure') return 'adventure'
  if (ctx.profile.travelStyle.style === 'luxury_focus') return 'relaxation'
  return 'general'
}

export function goalAxisBoosts(goal: TravelGoal): Partial<Record<string, number>> {
  switch (goal) {
    case 'family':
      return { family: 0.25, safety: 0.2, activities: 0.1 }
    case 'honeymoon':
    case 'relaxation':
      return { luxury: 0.2, comfort: 0.2, weather: 0.15 }
    case 'adventure':
    case 'photography':
      return { activities: 0.25, weather: 0.1, time: 0.05 }
    case 'business':
    case 'conference':
      return { business: 0.3, time: 0.2, comfort: 0.1 }
    case 'medical':
      return { safety: 0.3, comfort: 0.15 }
    case 'shopping':
      return { activities: 0.15, price: 0.1 }
    case 'food':
      return { activities: 0.2, comfort: 0.1 }
    case 'pilgrimage':
      return { safety: 0.25, visa: 0.15 }
    default:
      return {}
  }
}
