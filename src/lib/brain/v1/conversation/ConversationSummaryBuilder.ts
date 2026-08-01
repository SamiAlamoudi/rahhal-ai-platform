/**
 * Sprint 85 — Conversation Summary.
 * Current goal, known information, remaining questions, recommendations.
 */

import type { TravelPlanSlotKey, TravelPlanSlots } from '../planning/types'
import type { ConversationSummary } from './types'

function slotValue(slots: TravelPlanSlots, key: TravelPlanSlotKey): string | null {
  switch (key) {
    case 'dates':
      if (!slots.dates.start && !slots.dates.end) return null
      return `${slots.dates.start ?? '?'}${slots.dates.end ? ` → ${slots.dates.end}` : ''}`
    case 'activities':
      return slots.activities.length ? slots.activities.join(', ') : null
    case 'flexibleDates':
      return slots.flexibleDates == null ? null : String(slots.flexibleDates)
    case 'adults':
    case 'children':
    case 'budget':
      return slots[key] == null ? null : String(slots[key])
    default:
      return (slots[key] as string | null) ?? null
  }
}

export class ConversationSummaryBuilder {
  build(input: {
    goalLabel: string
    intentLabel?: string
    slots: TravelPlanSlots
    remaining: TravelPlanSlotKey[]
    recommendations?: string[]
  }): ConversationSummary {
    const knownKeys: TravelPlanSlotKey[] = [
      'destination',
      'origin',
      'dates',
      'adults',
      'children',
      'budget',
      'cabin',
      'hotelPreference',
      'currency',
    ]
    const knownInformation: ConversationSummary['knownInformation'] = []
    if (input.intentLabel) {
      knownInformation.push({ slot: 'intent', value: input.intentLabel })
    }
    for (const key of knownKeys) {
      const value = slotValue(input.slots, key)
      if (value) knownInformation.push({ slot: key, value })
    }

    const recs = input.recommendations ?? []
    const knownLine = knownInformation.map((k) => `${k.slot}=${k.value}`).join(' · ') || '—'
    const remainLine = input.remaining.length ? input.remaining.join(', ') : 'none'
    const recLine = recs.length ? recs.join(' · ') : 'none yet'

    return {
      currentGoal: input.goalLabel,
      knownInformation,
      remainingQuestions: [...input.remaining],
      currentRecommendations: [...recs],
      textAr: `الهدف: ${input.goalLabel}. المعروف: ${knownLine}. المتبقي: ${remainLine}. الترشيحات: ${recLine}.`,
      textEn: `Goal: ${input.goalLabel}. Known: ${knownLine}. Remaining: ${remainLine}. Recommendations: ${recLine}.`,
    }
  }
}

export function createConversationSummaryBuilder(): ConversationSummaryBuilder {
  return new ConversationSummaryBuilder()
}
