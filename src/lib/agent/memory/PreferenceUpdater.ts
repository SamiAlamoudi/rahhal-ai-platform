/**
 * Sprint 112 — PreferenceUpdater
 * Merge / update / remove obsolete preferences with confidence tracking.
 */

import { syncTravelStyleFlags } from './TravelerProfile'
import type {
  CabinClassKind,
  ExtractedPreferenceSignal,
  MemoryTravelerProfile,
  PreferencePolarity,
  PreferenceValue,
  SeatTypeKind,
  TravelStyleKind,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 1000) / 1000))
}

function bumpConfidence(
  previous: number,
  incoming: number,
  conflict: boolean,
): number {
  if (conflict) return clamp01(previous * 0.6 + incoming * 0.25)
  return clamp01(previous + (1 - previous) * Math.max(0.15, incoming * 0.35))
}

function upsertListValue(
  list: PreferenceValue[],
  value: string,
  polarity: PreferencePolarity,
  confidence: number,
  source: PreferenceValue['source'] = 'conversation',
): PreferenceValue[] {
  const key = value.toLowerCase()
  const idx = list.findIndex((p) => p.value.toLowerCase() === key)
  if (idx < 0) {
    return [
      ...list,
      {
        value,
        confidence: clamp01(confidence),
        polarity,
        observations: 1,
        updatedAt: nowIso(),
        source,
      },
    ]
  }
  const prev = list[idx]!
  const conflict = prev.polarity !== polarity
  const next: PreferenceValue = {
    ...prev,
    polarity,
    confidence: bumpConfidence(prev.confidence, confidence, conflict),
    observations: prev.observations + 1,
    updatedAt: nowIso(),
    source,
  }
  const copy = list.slice()
  copy[idx] = next
  return copy
}

function upsertScalar<T extends string | number>(
  current: PreferenceValue<T> | null,
  value: T,
  polarity: PreferencePolarity,
  confidence: number,
): PreferenceValue<T> {
  if (!current) {
    return {
      value,
      confidence: clamp01(confidence),
      polarity,
      observations: 1,
      updatedAt: nowIso(),
      source: 'conversation',
    }
  }
  const conflict =
    current.polarity !== polarity || current.value !== value
  return {
    value,
    polarity,
    confidence: bumpConfidence(current.confidence, confidence, conflict),
    observations: current.observations + 1,
    updatedAt: nowIso(),
    source: 'conversation',
  }
}

/** Drop low-confidence stale preferences (obsolete). */
export function pruneObsoletePreferences(
  profile: MemoryTravelerProfile,
  minConfidence = 0.2,
  maxAgeMs = 1000 * 60 * 60 * 24 * 365,
): MemoryTravelerProfile {
  const cutoff = Date.now() - maxAgeMs
  const keep = <T extends PreferenceValue>(list: T[]): T[] =>
    list.filter((p) => {
      if (p.confidence < minConfidence) return false
      const t = Date.parse(p.updatedAt)
      if (Number.isFinite(t) && t < cutoff && p.confidence < 0.45) return false
      return true
    })

  return {
    ...profile,
    preferredAirlines: keep(profile.preferredAirlines),
    preferredHotelChains: keep(profile.preferredHotelChains),
    preferredDestinations: keep(profile.preferredDestinations),
    preferredCountries: keep(profile.preferredCountries),
    preferredDepartureAirports: keep(profile.preferredDepartureAirports),
    preferredArrivalAirports: keep(profile.preferredArrivalAirports),
    preferredMealOptions: keep(profile.preferredMealOptions),
    preferredHotelAmenities: keep(profile.preferredHotelAmenities),
    travelStyles: keep(profile.travelStyles),
    preferredDepartureTimes: profile.preferredDepartureTimes.filter(
      (p) => p.confidence >= minConfidence,
    ),
    preferredCabinClass:
      profile.preferredCabinClass
      && profile.preferredCabinClass.confidence >= minConfidence
        ? profile.preferredCabinClass
        : null,
    preferredHotelStars:
      profile.preferredHotelStars
      && profile.preferredHotelStars.confidence >= minConfidence
        ? profile.preferredHotelStars
        : null,
    preferredSeatType:
      profile.preferredSeatType
      && profile.preferredSeatType.confidence >= minConfidence
        ? profile.preferredSeatType
        : null,
    language:
      profile.language && profile.language.confidence >= minConfidence
        ? profile.language
        : null,
    currency:
      profile.currency && profile.currency.confidence >= minConfidence
        ? profile.currency
        : null,
    timezone:
      profile.timezone && profile.timezone.confidence >= minConfidence
        ? profile.timezone
        : null,
    updatedAt: nowIso(),
  }
}

export function applyPreferenceSignals(
  profile: MemoryTravelerProfile,
  signals: ExtractedPreferenceSignal[],
): MemoryTravelerProfile {
  let next: MemoryTravelerProfile = { ...profile }

  for (const signal of signals) {
    switch (signal.key) {
      case 'preferredAirlines':
        next = {
          ...next,
          preferredAirlines: upsertListValue(
            next.preferredAirlines,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredHotelChains':
        next = {
          ...next,
          preferredHotelChains: upsertListValue(
            next.preferredHotelChains,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredDestinations':
        next = {
          ...next,
          preferredDestinations: upsertListValue(
            next.preferredDestinations,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredCountries':
        next = {
          ...next,
          preferredCountries: upsertListValue(
            next.preferredCountries,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredDepartureAirports':
        next = {
          ...next,
          preferredDepartureAirports: upsertListValue(
            next.preferredDepartureAirports,
            String(signal.value).toUpperCase(),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredArrivalAirports':
        next = {
          ...next,
          preferredArrivalAirports: upsertListValue(
            next.preferredArrivalAirports,
            String(signal.value).toUpperCase(),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredMealOptions':
        next = {
          ...next,
          preferredMealOptions: upsertListValue(
            next.preferredMealOptions,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredHotelAmenities':
        next = {
          ...next,
          preferredHotelAmenities: upsertListValue(
            next.preferredHotelAmenities,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'travelStyles':
        next = {
          ...next,
          travelStyles: upsertListValue(
            next.travelStyles as PreferenceValue[],
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ) as PreferenceValue<TravelStyleKind>[],
        }
        break
      case 'preferredCabinClass':
        next = {
          ...next,
          preferredCabinClass: upsertScalar(
            next.preferredCabinClass,
            signal.value as CabinClassKind,
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredSeatType':
        next = {
          ...next,
          preferredSeatType: upsertScalar(
            next.preferredSeatType,
            signal.value as SeatTypeKind,
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'preferredHotelStars':
        next = {
          ...next,
          preferredHotelStars: upsertScalar(
            next.preferredHotelStars,
            Number(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'typicalTripDurationDays':
        next = {
          ...next,
          typicalTripDurationDays: upsertScalar(
            next.typicalTripDurationDays,
            Number(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'language':
        next = {
          ...next,
          language: upsertScalar(
            next.language,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'currency':
        next = {
          ...next,
          currency: upsertScalar(
            next.currency,
            String(signal.value).toUpperCase(),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'timezone':
        next = {
          ...next,
          timezone: upsertScalar(
            next.timezone,
            String(signal.value),
            signal.polarity,
            signal.confidence,
          ),
        }
        break
      case 'budgetRange': {
        const amount = Number(signal.value)
        const currency = next.currency?.value ?? next.budgetRange?.currency ?? 'SAR'
        if (!Number.isFinite(amount) || amount <= 0) break
        const prev = next.budgetRange
        next = {
          ...next,
          budgetRange: {
            min: prev?.min ?? Math.round(amount * 0.75),
            max: prev?.max ?? Math.round(amount * 1.25),
            typical: amount,
            currency,
            confidence: bumpConfidence(prev?.confidence ?? 0.4, signal.confidence, false),
            observations: (prev?.observations ?? 0) + 1,
            updatedAt: nowIso(),
          },
        }
        break
      }
      case 'preferredLayoverMinutes': {
        const minutes = Number(signal.value)
        const preferDirect = minutes === 0 || signal.polarity === 'prefer' && minutes <= 0
        const avoidLong = signal.polarity === 'avoid'
        next = {
          ...next,
          preferredLayover: {
            maxMinutes: avoidLong ? minutes : minutes,
            preferDirect: preferDirect || avoidLong,
            confidence: bumpConfidence(
              next.preferredLayover?.confidence ?? 0.4,
              signal.confidence,
              false,
            ),
            observations: (next.preferredLayover?.observations ?? 0) + 1,
            updatedAt: nowIso(),
          },
        }
        break
      }
      case 'preferredDepartureTimes': {
        const window = String(signal.value) as
          | 'morning'
          | 'afternoon'
          | 'evening'
          | 'night'
          | 'any'
        const list = next.preferredDepartureTimes.slice()
        const idx = list.findIndex((p) => p.window === window)
        if (idx < 0) {
          list.push({
            window,
            confidence: clamp01(signal.confidence),
            observations: 1,
            updatedAt: nowIso(),
          })
        } else {
          const prev = list[idx]!
          list[idx] = {
            ...prev,
            confidence: bumpConfidence(prev.confidence, signal.confidence, false),
            observations: prev.observations + 1,
            updatedAt: nowIso(),
          }
        }
        next = { ...next, preferredDepartureTimes: list }
        break
      }
      default:
        break
    }
  }

  next = pruneObsoletePreferences(syncTravelStyleFlags(next))
  next.updatedAt = nowIso()
  return next
}

export function mergeProfiles(
  base: MemoryTravelerProfile,
  incoming: MemoryTravelerProfile,
): MemoryTravelerProfile {
  // Convert incoming list prefs into signals and apply
  const signals: ExtractedPreferenceSignal[] = []
  for (const p of incoming.preferredAirlines) {
    signals.push({
      key: 'preferredAirlines',
      value: p.value,
      polarity: p.polarity,
      confidence: p.confidence,
      raw: 'merge',
    })
  }
  for (const p of incoming.preferredHotelChains) {
    signals.push({
      key: 'preferredHotelChains',
      value: p.value,
      polarity: p.polarity,
      confidence: p.confidence,
      raw: 'merge',
    })
  }
  for (const p of incoming.preferredDestinations) {
    signals.push({
      key: 'preferredDestinations',
      value: p.value,
      polarity: p.polarity,
      confidence: p.confidence,
      raw: 'merge',
    })
  }
  for (const p of incoming.travelStyles) {
    signals.push({
      key: 'travelStyles',
      value: p.value,
      polarity: p.polarity,
      confidence: p.confidence,
      raw: 'merge',
    })
  }
  if (incoming.preferredCabinClass) {
    signals.push({
      key: 'preferredCabinClass',
      value: incoming.preferredCabinClass.value,
      polarity: incoming.preferredCabinClass.polarity,
      confidence: incoming.preferredCabinClass.confidence,
      raw: 'merge',
    })
  }
  if (incoming.budgetRange?.typical != null) {
    signals.push({
      key: 'budgetRange',
      value: incoming.budgetRange.typical,
      polarity: 'prefer',
      confidence: incoming.budgetRange.confidence,
      raw: 'merge',
    })
  }
  return applyPreferenceSignals(base, signals)
}

export class PreferenceUpdater {
  apply(
    profile: MemoryTravelerProfile,
    signals: ExtractedPreferenceSignal[],
  ): MemoryTravelerProfile {
    return applyPreferenceSignals(profile, signals)
  }

  merge(
    base: MemoryTravelerProfile,
    incoming: MemoryTravelerProfile,
  ): MemoryTravelerProfile {
    return mergeProfiles(base, incoming)
  }

  prune(profile: MemoryTravelerProfile): MemoryTravelerProfile {
    return pruneObsoletePreferences(profile)
  }
}

export function createPreferenceUpdater(): PreferenceUpdater {
  return new PreferenceUpdater()
}
