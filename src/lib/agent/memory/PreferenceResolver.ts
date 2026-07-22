/**
 * Sprint 112 — PreferenceResolver
 * Apply memory preferences to recommendation context.
 * Explicit current-conversation requests always win.
 */

import { topPreferredValues } from './TravelerProfile'
import type {
  ExplicitRequestOverrides,
  MemoryTravelerProfile,
  PreferenceResolution,
  TravelStyleKind,
} from './types'

export function resolvePreferences(input: {
  profile: MemoryTravelerProfile | null
  explicit?: ExplicitRequestOverrides | null
}): PreferenceResolution {
  const profile = input.profile
  const explicit = input.explicit ?? {}
  const matched: string[] = []
  const ignored: string[] = []
  const overrides: string[] = []

  const airlines = topPreferredValues(profile?.preferredAirlines ?? [])
  const hotelChains = topPreferredValues(profile?.preferredHotelChains ?? [])
  const destinations = topPreferredValues(profile?.preferredDestinations ?? [])
  const styles = (profile?.travelStyles ?? [])
    .filter((s) => s.polarity === 'prefer')
    .map((s) => s.value)

  let cabin = profile?.preferredCabinClass?.value ?? null
  let hotelStarsMin = profile?.preferredHotelStars?.value ?? null
  let budgetTypical = profile?.budgetRange?.typical ?? null
  let currency = profile?.currency?.value ?? profile?.budgetRange?.currency ?? null
  let preferDirect = profile?.preferredLayover?.preferDirect ?? false
  let maxLayoverMinutes = profile?.preferredLayover?.maxMinutes ?? null

  if (profile?.preferredAirlines.length) matched.push('preferredAirlines')
  if (profile?.preferredHotelChains.length) matched.push('preferredHotelChains')
  if (profile?.preferredCabinClass) matched.push('preferredCabinClass')
  if (profile?.preferredHotelStars) matched.push('preferredHotelStars')
  if (profile?.budgetRange) matched.push('budgetRange')
  if (profile?.preferredLayover) matched.push('preferredLayover')
  if (styles.length) matched.push('travelStyles')

  // Explicit overrides — current conversation wins
  if (explicit.airline?.trim()) {
    overrides.push('airline')
    if (airlines.length) ignored.push('preferredAirlines')
  }
  if (explicit.hotelChain?.trim()) {
    overrides.push('hotelChain')
    if (hotelChains.length) ignored.push('preferredHotelChains')
  }
  if (explicit.cabin?.trim()) {
    overrides.push('cabin')
    cabin = explicit.cabin.trim().toLowerCase().replace(/\s+/g, '_') as typeof cabin
    if (profile?.preferredCabinClass) ignored.push('preferredCabinClass')
  }
  if (explicit.budget != null && Number.isFinite(explicit.budget)) {
    overrides.push('budget')
    budgetTypical = explicit.budget
    if (profile?.budgetRange) ignored.push('budgetRange')
  }
  if (explicit.destination?.trim()) {
    overrides.push('destination')
    if (destinations.length) ignored.push('preferredDestinations')
  }
  if (explicit.maxStops != null) {
    overrides.push('maxStops')
    preferDirect = explicit.maxStops === 0
    maxLayoverMinutes = explicit.maxStops === 0 ? 0 : maxLayoverMinutes
    if (profile?.preferredLayover) ignored.push('preferredLayover')
  }
  if (explicit.currency?.trim()) {
    overrides.push('currency')
    currency = explicit.currency.trim().toUpperCase()
  }

  const effectiveAirlines = explicit.airline?.trim()
    ? [explicit.airline.trim()]
    : airlines
  const effectiveHotels = explicit.hotelChain?.trim()
    ? [explicit.hotelChain.trim()]
    : hotelChains
  const effectiveDestinations = explicit.destination?.trim()
    ? [explicit.destination.trim()]
    : destinations

  const reasoningSummary =
    overrides.length > 0
      ? `Applied ${matched.length} memory preference group(s); current conversation overrides: ${overrides.join(', ')}.`
      : matched.length > 0
        ? `Applied ${matched.length} memory preference group(s) with no explicit overrides.`
        : 'No stored preferences available; using conversation context only.'

  return {
    effective: {
      airlines: effectiveAirlines,
      hotelChains: effectiveHotels,
      cabin,
      hotelStarsMin,
      destinations: effectiveDestinations,
      budgetTypical,
      currency,
      preferDirect,
      maxLayoverMinutes,
      travelStyles: styles as TravelStyleKind[],
    },
    matchedPreferences: matched,
    ignoredPreferences: ignored,
    overridesApplied: overrides,
    reasoningSummary,
  }
}

export class PreferenceResolver {
  resolve(input: Parameters<typeof resolvePreferences>[0]): PreferenceResolution {
    return resolvePreferences(input)
  }
}

export function createPreferenceResolver(): PreferenceResolver {
  return new PreferenceResolver()
}
