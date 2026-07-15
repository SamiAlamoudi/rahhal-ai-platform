/**
 * Phase AC — PreferenceEngine with explicit/inferred preferences,
 * normalization, and weight calculation.
 */

import {
  defaultPreferenceWeights,
  emptyPersonalizationProfile,
  type PersonalizationProfile,
  type PreferenceWeights,
  type TravelStyle,
} from './types'

export interface PreferenceEngineOptions {
  /** When false, engine returns empty/default profiles only. */
  personalizationAllowed?: boolean
}

export interface ExplicitPreferences {
  travelerType?: PersonalizationProfile['traveler']['travelerTypes'][number] | null
  interests?: string[]
  budgetStyle?: PersonalizationProfile['budget']['style']
  budgetAmount?: number | null
  budgetCurrency?: string | null
  travelStyle?: TravelStyle | null
  pace?: PersonalizationProfile['travelStyle']['pace'] | null
  preferDirectFlights?: boolean
  preferCentralHotels?: boolean
  preferBreakfast?: boolean
  preferredAirlines?: string[]
  hotelCategories?: PersonalizationProfile['hotel']['categories']
}

export interface InferredPreferences {
  frequentDestinations?: string[]
  acceptedRecommendationKinds?: string[]
  avgCompletedTripDays?: number | null
  typicalSpend?: number | null
  interestSignals?: string[]
}

export interface NormalizedPreferences {
  keys: string[]
  travelerType: string | null
  interests: string[]
  travelStyle: TravelStyle
  budgetStyle: NonNullable<PersonalizationProfile['budget']['style']>
  budgetAmount: number | null
  budgetCurrency: string
  preferDirectFlights: boolean
  preferCentralHotels: boolean
  weights: PreferenceWeights
}

export interface PreferenceEngine {
  getProfile(userId: string | null): PersonalizationProfile
  upsertProfile(profile: PersonalizationProfile): PersonalizationProfile
  mergeWeights(userId: string | null, weights: Partial<PreferenceWeights>): PersonalizationProfile
  isPersonalizationAllowed(): boolean
  setExplicitPreferences(userId: string, explicit: ExplicitPreferences): PersonalizationProfile
  setInferredPreferences(userId: string, inferred: InferredPreferences): PersonalizationProfile
  normalizePreferences(userId: string | null): NormalizedPreferences
  calculateWeights(userId: string | null): PreferenceWeights
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))]
}

export function normalizePreferenceWeights(weights: PreferenceWeights): PreferenceWeights {
  const raw = {
    price: Math.max(0, weights.price),
    comfort: Math.max(0, weights.comfort),
    time: Math.max(0, weights.time),
    rating: Math.max(0, weights.rating),
    personalization: Math.max(0, weights.personalization),
  }
  const sum = raw.price + raw.comfort + raw.time + raw.rating + raw.personalization
  if (sum <= 0) return defaultPreferenceWeights()
  return {
    price: Number((raw.price / sum).toFixed(4)),
    comfort: Number((raw.comfort / sum).toFixed(4)),
    time: Number((raw.time / sum).toFixed(4)),
    rating: Number((raw.rating / sum).toFixed(4)),
    personalization: Number((raw.personalization / sum).toFixed(4)),
  }
}

export function calculatePreferenceWeights(
  explicit: ExplicitPreferences = {},
  inferred: InferredPreferences = {},
): PreferenceWeights {
  const base = defaultPreferenceWeights()
  const next = { ...base }

  if (explicit.budgetStyle === 'budget' || (explicit.budgetAmount != null && explicit.budgetAmount < 4000)) {
    next.price += 0.15
    next.comfort -= 0.05
  }
  if (explicit.budgetStyle === 'luxury') {
    next.comfort += 0.15
    next.price -= 0.05
  }
  if (explicit.preferDirectFlights) {
    next.time += 0.1
  }
  if (explicit.travelStyle === 'packed' || explicit.pace === 'fast') {
    next.time += 0.08
  }
  if (explicit.travelStyle === 'relaxed' || explicit.pace === 'slow') {
    next.comfort += 0.08
  }
  if ((explicit.interests?.length ?? 0) >= 3 || (inferred.interestSignals?.length ?? 0) >= 3) {
    next.personalization += 0.1
  }
  if ((inferred.acceptedRecommendationKinds?.length ?? 0) > 0) {
    next.personalization += 0.05
    next.rating += 0.05
  }
  if (inferred.typicalSpend != null && explicit.budgetAmount != null) {
    if (inferred.typicalSpend > explicit.budgetAmount) next.price += 0.05
  }

  return normalizePreferenceWeights(next)
}

export class InMemoryPreferenceEngine implements PreferenceEngine {
  private readonly store = new Map<string, PersonalizationProfile>()
  private readonly explicit = new Map<string, ExplicitPreferences>()
  private readonly inferred = new Map<string, InferredPreferences>()
  private personalizationAllowed: boolean

  constructor(options: PreferenceEngineOptions = {}) {
    this.personalizationAllowed = options.personalizationAllowed !== false
  }

  isPersonalizationAllowed(): boolean {
    return this.personalizationAllowed
  }

  setPersonalizationAllowed(allowed: boolean): void {
    this.personalizationAllowed = allowed
  }

  getProfile(userId: string | null): PersonalizationProfile {
    if (!this.personalizationAllowed || !userId) {
      return emptyPersonalizationProfile(userId)
    }
    return this.store.get(userId) ?? emptyPersonalizationProfile(userId)
  }

  upsertProfile(profile: PersonalizationProfile): PersonalizationProfile {
    if (!this.personalizationAllowed) {
      return emptyPersonalizationProfile(profile.userId)
    }
    const next = {
      ...structuredClone(profile),
      version: 1 as const,
      weights: normalizePreferenceWeights(profile.weights),
      updatedAt: new Date().toISOString(),
    }
    if (profile.userId) this.store.set(profile.userId, next)
    return structuredClone(next)
  }

  mergeWeights(userId: string | null, weights: Partial<PreferenceWeights>): PersonalizationProfile {
    const current = this.getProfile(userId)
    if (!this.personalizationAllowed || !userId) return current
    const merged = {
      ...current,
      weights: normalizePreferenceWeights({ ...current.weights, ...weights }),
      updatedAt: new Date().toISOString(),
    }
    return this.upsertProfile(merged)
  }

  setExplicitPreferences(userId: string, explicit: ExplicitPreferences): PersonalizationProfile {
    this.explicit.set(userId, { ...explicit })
    const current = this.getProfile(userId)
    const next: PersonalizationProfile = {
      ...current,
      userId,
      traveler: {
        ...current.traveler,
        travelerTypes: explicit.travelerType
          ? [explicit.travelerType]
          : current.traveler.travelerTypes,
      },
      hotel: {
        ...current.hotel,
        preferCentral: explicit.preferCentralHotels ?? current.hotel.preferCentral,
        preferBreakfast: explicit.preferBreakfast ?? current.hotel.preferBreakfast,
        categories: explicit.hotelCategories ?? current.hotel.categories,
      },
      airline: {
        ...current.airline,
        preferDirect: explicit.preferDirectFlights ?? current.airline.preferDirect,
        preferredAirlines: explicit.preferredAirlines ?? current.airline.preferredAirlines,
      },
      budget: {
        ...current.budget,
        style: explicit.budgetStyle ?? current.budget.style,
        typicalTripBudget: explicit.budgetAmount ?? current.budget.typicalTripBudget,
        currency: explicit.budgetCurrency ?? current.budget.currency,
      },
      travelStyle: {
        ...current.travelStyle,
        style: explicit.travelStyle ?? current.travelStyle.style,
        pace: explicit.pace ?? current.travelStyle.pace,
        interests: uniq([
          ...current.travelStyle.interests,
          ...(explicit.interests ?? []),
        ]),
      },
      weights: calculatePreferenceWeights(explicit, this.inferred.get(userId) ?? {}),
    }
    return this.upsertProfile(next)
  }

  setInferredPreferences(userId: string, inferred: InferredPreferences): PersonalizationProfile {
    this.inferred.set(userId, { ...inferred })
    const current = this.getProfile(userId)
    const explicit = this.explicit.get(userId) ?? {}
    const next: PersonalizationProfile = {
      ...current,
      userId,
      budget: {
        ...current.budget,
        typicalTripBudget: current.budget.typicalTripBudget ?? inferred.typicalSpend ?? null,
      },
      travelStyle: {
        ...current.travelStyle,
        interests: uniq([
          ...current.travelStyle.interests,
          ...(inferred.interestSignals ?? []),
        ]),
      },
      weights: calculatePreferenceWeights(explicit, inferred),
    }
    return this.upsertProfile(next)
  }

  normalizePreferences(userId: string | null): NormalizedPreferences {
    const profile = this.getProfile(userId)
    const explicit = userId ? this.explicit.get(userId) ?? {} : {}
    const travelerType = explicit.travelerType
      ?? profile.traveler.travelerTypes[0]
      ?? null
    const interests = uniq([
      ...profile.travelStyle.interests,
      ...(explicit.interests ?? []),
    ])
    const travelStyle = explicit.travelStyle ?? profile.travelStyle.style
    const budgetStyle = explicit.budgetStyle ?? profile.budget.style ?? 'midrange'
    const keys = [
      travelerType ? `travelerType:${travelerType}` : null,
      ...interests.map((i) => `interest:${i}`),
      `travelStyle:${travelStyle}`,
      `budgetStyle:${budgetStyle}`,
      profile.airline.preferDirect ? 'airline:preferDirect' : null,
      profile.hotel.preferCentral ? 'hotel:preferCentral' : null,
    ].filter((k): k is string => Boolean(k))

    return {
      keys: keys.sort(),
      travelerType,
      interests,
      travelStyle,
      budgetStyle,
      budgetAmount: explicit.budgetAmount ?? profile.budget.typicalTripBudget,
      budgetCurrency: explicit.budgetCurrency ?? profile.budget.currency,
      preferDirectFlights: explicit.preferDirectFlights ?? profile.airline.preferDirect,
      preferCentralHotels: explicit.preferCentralHotels ?? profile.hotel.preferCentral,
      weights: normalizePreferenceWeights(profile.weights),
    }
  }

  calculateWeights(userId: string | null): PreferenceWeights {
    if (!userId) return defaultPreferenceWeights()
    return calculatePreferenceWeights(
      this.explicit.get(userId) ?? {},
      this.inferred.get(userId) ?? {},
    )
  }

  clear(): void {
    this.store.clear()
    this.explicit.clear()
    this.inferred.clear()
  }
}

let defaultEngine: InMemoryPreferenceEngine | null = null

export function getPreferenceEngine(): InMemoryPreferenceEngine {
  if (!defaultEngine) defaultEngine = new InMemoryPreferenceEngine()
  return defaultEngine
}

export function resetPreferenceEngine(): void {
  defaultEngine?.clear()
  defaultEngine = null
}
