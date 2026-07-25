/**
 * Integration Sprint 9 — cost memory (preferred budget / luxury / airlines / hotel class).
 * In-process only; additive — does not replace preferenceBridge persistence.
 */

import type { TripRequirements } from '../types'
import type { BudgetTier, CostMemorySnapshot } from './types'

const store = new Map<string, CostMemorySnapshot>()

function emptyMemory(): CostMemorySnapshot {
  return {
    preferredBudget: null,
    preferredCurrency: null,
    luxuryPreference: false,
    favoriteAirlines: [],
    favoriteHotelClass: null,
    lastTier: null,
  }
}

export function readCostMemory(userId?: string | null): CostMemorySnapshot {
  if (!userId) return emptyMemory()
  return store.get(userId) ?? emptyMemory()
}

export function learnCostMemory(input: {
  userId?: string | null
  requirements?: TripRequirements | null
  tier?: BudgetTier | null
  airline?: string | null
  hotelClass?: string | null
}): CostMemorySnapshot {
  const key = input.userId ?? 'anonymous'
  const prev = readCostMemory(key)
  const next: CostMemorySnapshot = {
    preferredBudget: input.requirements?.budgetAmount ?? prev.preferredBudget,
    preferredCurrency: input.requirements?.budgetCurrency ?? prev.preferredCurrency,
    luxuryPreference:
      input.requirements?.budgetStyle === 'luxury'
      || prev.luxuryPreference
      || input.tier === 'luxury',
    favoriteAirlines: unique([
      ...prev.favoriteAirlines,
      ...(input.airline ? [input.airline] : []),
    ]).slice(0, 5),
    favoriteHotelClass: input.hotelClass ?? prev.favoriteHotelClass,
    lastTier: input.tier ?? prev.lastTier,
  }
  store.set(key, next)
  return next
}

export function resetCostMemoryForTests(): void {
  store.clear()
}

function unique(values: string[]): string[] {
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
