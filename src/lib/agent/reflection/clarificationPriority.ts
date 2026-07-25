/**
 * Evolution Sprint 2 — ClarificationPriority
 * Rank missing information; priorities change as memory fills.
 */

import type { ClarificationItem, KnownSlots, RecommendationRecord } from './reflectionTypes'
import { uniqueStrings } from './reflectionTypes'

const FIELD_WEIGHT: Record<string, number> = {
  destination: 100,
  destination_or_flexibility: 95,
  trip_purpose: 90,
  trip_purpose_for_destination_fit: 88,
  clear_travel_goal: 85,
  budget_amount: 80,
  budget_stance: 70,
  duration: 75,
  party_size: 65,
  risk_tolerance: 55,
}

function blockingFor(field: string, slots: KnownSlots): boolean {
  if (field.includes('destination') && !slots.destination) return true
  if (field.includes('budget') && typeof slots.budgetAmount !== 'number') return true
  if (field === 'duration' && typeof slots.durationDays !== 'number') return true
  if (field.includes('trip_purpose') && !slots.tripPurpose) return true
  return false
}

export function buildClarificationQueue(
  missingData: string[],
  slots: KnownSlots,
  priorities: string[],
): ClarificationItem[] {
  const fields = uniqueStrings(missingData)
  const items: ClarificationItem[] = fields.map((field) => {
    let priority = FIELD_WEIGHT[field] ?? 40
    // Boost fields aligned with current traveler priorities.
    if (priorities.includes('destination_discovery') && field.includes('destination')) {
      priority += 15
    }
    if (priorities.includes('budget_clarity') && field.includes('budget')) {
      priority += 10
    }
    if (priorities.includes('purpose:' + (slots.tripPurpose ?? '')) && field.includes('purpose')) {
      priority += 5
    }
    // Demote fields already satisfied in slots.
    if (field.includes('destination') && slots.destination) priority -= 50
    if (field.includes('budget') && typeof slots.budgetAmount === 'number') priority -= 50
    if (field === 'duration' && typeof slots.durationDays === 'number') priority -= 50
    if (field.includes('trip_purpose') && slots.tripPurpose) priority -= 50

    return {
      field,
      priority: Math.max(0, priority),
      reason: `Missing "${field}" reduces consultant confidence.`,
      blocking: blockingFor(field, slots),
    }
  })

  return items
    .filter((i) => i.priority > 0)
    .sort((a, b) => b.priority - a.priority || a.field.localeCompare(b.field))
}

export function missingFromRecommendation(rec: RecommendationRecord | null): string[] {
  return rec?.missingData ?? []
}

export const ClarificationPriority = {
  buildClarificationQueue,
  missingFromRecommendation,
}
