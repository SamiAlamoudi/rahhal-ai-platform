/**
 * Sprint 112 — TravelHistory
 * Structured history summaries from conversation memory + profile.
 */

import { topPreferredValues } from './TravelerProfile'
import type {
  ConversationMemoryState,
  MemoryTravelerProfile,
  TravelHistorySummary,
} from './types'

function average(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100
}

function mode(values: string[]): string | null {
  if (values.length === 0) return null
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v.trim()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [k, c] of counts) {
    if (c > bestCount) {
      best = k
      bestCount = c
    }
  }
  return best
}

export function generateTravelHistory(input: {
  profile: MemoryTravelerProfile | null
  conversationMemory: ConversationMemoryState | null
}): TravelHistorySummary {
  const profile = input.profile
  const memory = input.conversationMemory
  const notes: string[] = []

  const accepted = memory?.acceptedItineraries ?? []
  const searches = memory?.recentSearches ?? []
  const destinations = [
    ...accepted.map((a) => a.destination).filter(Boolean) as string[],
    ...searches.map((s) => s.destination).filter(Boolean) as string[],
    ...(memory?.previousDestinations ?? []).map((d) => d.value),
  ]

  const favoriteCity =
    mode(destinations)
    ?? topPreferredValues(profile?.preferredDestinations ?? [], 1)[0]
    ?? null

  const countries = [
    ...topPreferredValues(profile?.preferredCountries ?? []),
  ]
  const mostVisitedCountry = mode(countries) ?? countries[0] ?? null

  const costs = [
    ...accepted.map((a) => a.price).filter((p): p is number => p != null),
    ...searches.map((s) => s.budget).filter((b): b is number => b != null),
  ]
  if (profile?.budgetRange?.typical != null) {
    costs.push(profile.budgetRange.typical)
  }
  const averageTripCost = average(costs)

  const stayDays: number[] = []
  if (profile?.typicalTripDurationDays?.value != null) {
    stayDays.push(profile.typicalTripDurationDays.value)
  }
  for (const s of searches) {
    if (s.departureDate && s.returnDate) {
      const a = Date.parse(s.departureDate)
      const b = Date.parse(s.returnDate)
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
        stayDays.push(Math.round((b - a) / 86_400_000))
      }
    }
  }
  const averageStayNights = average(stayDays)

  const airlines = [
    ...accepted.map((a) => a.airline).filter(Boolean) as string[],
    ...topPreferredValues(profile?.preferredAirlines ?? []),
  ]
  const favoriteAirline = mode(airlines)

  const hotels = [
    ...accepted.map((a) => a.hotelName).filter(Boolean) as string[],
    ...topPreferredValues(profile?.preferredHotelChains ?? []),
  ]
  const favoriteHotelChain = mode(hotels)

  const tripCount = Math.max(
    accepted.length,
    searches.length,
    memory?.conversationIds.length ?? 0,
  )

  const currency =
    profile?.currency?.value
    ?? profile?.budgetRange?.currency
    ?? accepted[0]?.currency
    ?? searches[0]?.currency
    ?? null

  if (favoriteCity) notes.push(`Favorite city signal: ${favoriteCity}`)
  if (favoriteAirline) notes.push(`Favorite airline signal: ${favoriteAirline}`)
  if (averageTripCost != null) {
    notes.push(`Average trip cost signal: ${averageTripCost}${currency ? ` ${currency}` : ''}`)
  }
  if (tripCount === 0) notes.push('No travel history recorded yet')

  return {
    userId: profile?.userId ?? memory?.userId ?? 'unknown',
    mostVisitedCountry,
    favoriteCity,
    averageTripCost,
    averageStayNights,
    favoriteAirline,
    favoriteHotelChain,
    tripCount,
    currency,
    notes,
  }
}

export class TravelHistory {
  generate(input: Parameters<typeof generateTravelHistory>[0]): TravelHistorySummary {
    return generateTravelHistory(input)
  }
}

export function createTravelHistory(): TravelHistory {
  return new TravelHistory()
}
