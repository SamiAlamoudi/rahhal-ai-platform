/**
 * Phase 5 — ContextOptimizer
 * Compress old context, drop duplicates, keep important travel facts.
 */

import type { LiveTravelMemory } from '../conversationIntelligence'
import type { ConversationStateSnapshot } from './types'

function uniq(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v.trim())
  }
  return out
}

/** Important travel facts retained for the prompt window. */
export function compressTravelFacts(memory: LiveTravelMemory): string[] {
  const facts: string[] = []
  if (memory.destination) facts.push(`destination=${memory.destination}`)
  if (memory.cities.length) facts.push(`cities=${memory.cities.slice(0, 4).join('|')}`)
  if (memory.monthHint) facts.push(`month=${memory.monthHint}`)
  if (memory.flexibleDates) facts.push('dates=flexible')
  if (memory.startDate) facts.push(`start=${memory.startDate}`)
  if (memory.budgetAmount != null) {
    facts.push(`budget=${memory.budgetAmount}${memory.currency ?? 'SAR'}`)
  }
  const { adults, children, infants, total } = memory.travelers
  if (adults != null || total != null) {
    facts.push(`travelers=a${adults ?? 0}/c${children ?? 0}/i${infants ?? 0}`)
  }
  if (memory.purpose) facts.push(`purpose=${memory.purpose}`)
  if (memory.hotelPreferences.length) {
    facts.push(`hotel=${memory.hotelPreferences.slice(0, 3).join('|')}`)
  }
  if (memory.flightPreferences.length) {
    facts.push(`flight=${memory.flightPreferences.slice(0, 3).join('|')}`)
  }
  if (memory.airlines.length) facts.push(`airlines=${memory.airlines.slice(0, 2).join('|')}`)
  if (memory.stopoverPreference) facts.push(`stops=${memory.stopoverPreference}`)
  if (memory.visaStatus) facts.push(`visa=${memory.visaStatus}`)
  if (memory.passportNationality) facts.push(`passport=${memory.passportNationality}`)
  if (memory.weatherPreference) facts.push(`weather=${memory.weatherPreference}`)
  if (memory.specialRequests.length) {
    facts.push(`special=${memory.specialRequests.slice(0, 3).join('|')}`)
  }
  return uniq(facts)
}

export function optimizeContext(input: {
  state: ConversationStateSnapshot
  recentTexts?: string[]
}): {
  state: ConversationStateSnapshot
  recentCompressed: string[]
  compressed: boolean
} {
  const facts = compressTravelFacts(input.state.memory)
  const recent = uniq((input.recentTexts ?? []).map((t) => t.trim().slice(0, 120))).slice(-6)
  const droppedDupes =
    (input.recentTexts?.length ?? 0) > recent.length
    || facts.length < 20

  return {
    state: {
      ...input.state,
      compressedFacts: facts,
    },
    recentCompressed: recent,
    compressed: Boolean(droppedDupes || facts.length > 0),
  }
}

export const ContextOptimizer = {
  compressTravelFacts,
  optimizeContext,
}
