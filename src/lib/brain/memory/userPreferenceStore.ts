/**
 * Sprint 28 — UserPreferenceStore
 * Long-term travel preference memory with privacy-safe retention boundaries.
 */

import type { CabinClass } from '../types'
import { expiryFromNow, isExpired, resolvePolicy } from './expiration'
import { toLongTermSafeProfile } from './privacy'
import type {
  FamilyMember,
  MealPreference,
  MemoryExpirationPolicy,
  SeatPreference,
  TravelPreferenceProfile,
  VisaStatus,
} from './types'

export type UserPreferenceStoreOptions = {
  policy?: Partial<MemoryExpirationPolicy>
  /** When false, store returns empty profiles and refuses writes of sensitive data. */
  personalizationAllowed?: boolean
  /** When false, nationality is never retained long-term. */
  allowSensitiveRetention?: boolean
  now?: () => number
}

export type UserPreferenceStoreHandle = {
  get: (userId: string | null | undefined) => TravelPreferenceProfile | null
  upsert: (profile: TravelPreferenceProfile) => TravelPreferenceProfile | null
  merge: (
    userId: string,
    patch: Partial<TravelPreferenceProfile>,
  ) => TravelPreferenceProfile | null
  clear: (userId?: string) => void
  purgeExpired: () => number
  size: () => number
  isPersonalizationAllowed: () => boolean
  setPersonalizationAllowed: (allowed: boolean) => void
  emptyProfile: (userId: string) => TravelPreferenceProfile
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (!t) continue
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out
}

export function emptyTravelPreferenceProfile(
  userId: string,
  options?: {
    allowSensitiveRetention?: boolean
    ttlMs?: number | null
    now?: number
  },
): TravelPreferenceProfile {
  const now = options?.now ?? Date.now()
  const ttl = options?.ttlMs
  return {
    userId,
    version: 1,
    preferredAirlines: [],
    preferredHotelBrands: [],
    cabinClass: null,
    budgetRange: { min: null, max: null, currency: null },
    typicalTravelerCount: null,
    familyMembers: [],
    nationality: null,
    visaStatus: null,
    seatPreferences: [],
    mealPreferences: [],
    accessibilityRequirements: [],
    loyaltyPrograms: [],
    tripStyle: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    expiresAt:
      ttl == null ? null : expiryFromNow(ttl, now),
    allowSensitiveRetention: options?.allowSensitiveRetention === true,
  }
}

function cloneProfile(profile: TravelPreferenceProfile): TravelPreferenceProfile {
  return {
    ...profile,
    preferredAirlines: [...profile.preferredAirlines],
    preferredHotelBrands: [...profile.preferredHotelBrands],
    budgetRange: { ...profile.budgetRange },
    familyMembers: profile.familyMembers.map((m) => ({ ...m })),
    seatPreferences: [...profile.seatPreferences],
    mealPreferences: [...profile.mealPreferences],
    accessibilityRequirements: [...profile.accessibilityRequirements],
    loyaltyPrograms: [...profile.loyaltyPrograms],
    tripStyle: profile.tripStyle
      ? {
          ...profile.tripStyle,
          interests: [...profile.tripStyle.interests],
          avoid: [...profile.tripStyle.avoid],
        }
      : null,
  }
}

/**
 * In-memory long-term preference store.
 * Boundaries:
 * - Requires userId
 * - No passport numbers / loyalty member IDs
 * - Nationality only when allowSensitiveRetention is true
 * - Personalization gate can disable all reads/writes
 */
export function UserPreferenceStore(
  options: UserPreferenceStoreOptions = {},
): UserPreferenceStoreHandle {
  const store = new Map<string, TravelPreferenceProfile>()
  const policy = resolvePolicy(options.policy)
  const clock = options.now ?? (() => Date.now())
  let personalizationAllowed = options.personalizationAllowed !== false
  const defaultSensitive = options.allowSensitiveRetention === true

  function hydrate(profile: TravelPreferenceProfile): TravelPreferenceProfile | null {
    if (isExpired(profile.expiresAt, clock())) {
      store.delete(profile.userId)
      return null
    }
    return cloneProfile(toLongTermSafeProfile(profile))
  }

  return {
    isPersonalizationAllowed: () => personalizationAllowed,
    setPersonalizationAllowed(allowed) {
      personalizationAllowed = allowed
    },

    emptyProfile(userId) {
      return emptyTravelPreferenceProfile(userId, {
        allowSensitiveRetention: defaultSensitive,
        ttlMs: policy.longTermTtlMs,
        now: clock(),
      })
    },

    get(userId) {
      if (!personalizationAllowed || !userId) return null
      const existing = store.get(userId)
      if (!existing) return null
      return hydrate(existing)
    },

    upsert(profile) {
      if (!personalizationAllowed || !profile.userId) return null
      const now = clock()
      const safe = toLongTermSafeProfile({
        ...cloneProfile(profile),
        version: 1,
        updatedAt: new Date(now).toISOString(),
        expiresAt:
          policy.longTermTtlMs == null
            ? null
            : expiryFromNow(policy.longTermTtlMs, now),
        allowSensitiveRetention:
          profile.allowSensitiveRetention || defaultSensitive,
        nationality:
          profile.allowSensitiveRetention || defaultSensitive
            ? profile.nationality
            : null,
      })
      store.set(profile.userId, safe)
      return cloneProfile(safe)
    },

    merge(userId, patch) {
      if (!personalizationAllowed || !userId) return null
      const current = this.get(userId) ?? this.emptyProfile(userId)
      const allowSensitive =
        patch.allowSensitiveRetention ??
        current.allowSensitiveRetention ??
        defaultSensitive
      const merged: TravelPreferenceProfile = {
        ...current,
        preferredAirlines: unique([
          ...current.preferredAirlines,
          ...(patch.preferredAirlines ?? []),
        ]),
        preferredHotelBrands: unique([
          ...current.preferredHotelBrands,
          ...(patch.preferredHotelBrands ?? []),
        ]),
        cabinClass: (patch.cabinClass as CabinClass | null | undefined) ?? current.cabinClass,
        budgetRange: {
          min: patch.budgetRange?.min ?? current.budgetRange.min,
          max: patch.budgetRange?.max ?? current.budgetRange.max,
          currency: patch.budgetRange?.currency ?? current.budgetRange.currency,
        },
        typicalTravelerCount:
          patch.typicalTravelerCount ?? current.typicalTravelerCount,
        familyMembers: mergeFamily(
          current.familyMembers,
          patch.familyMembers ?? [],
        ),
        nationality: allowSensitive
          ? (patch.nationality ?? current.nationality)
          : null,
        visaStatus: (patch.visaStatus as VisaStatus | null | undefined) ?? current.visaStatus,
        seatPreferences: uniqueEnum([
          ...current.seatPreferences,
          ...((patch.seatPreferences as SeatPreference[] | undefined) ?? []),
        ]),
        mealPreferences: uniqueEnum([
          ...current.mealPreferences,
          ...((patch.mealPreferences as MealPreference[] | undefined) ?? []),
        ]),
        accessibilityRequirements: unique([
          ...current.accessibilityRequirements,
          ...(patch.accessibilityRequirements ?? []),
        ]),
        loyaltyPrograms: unique([
          ...current.loyaltyPrograms,
          ...(patch.loyaltyPrograms ?? []),
        ]),
        tripStyle: patch.tripStyle ?? current.tripStyle,
        allowSensitiveRetention: allowSensitive,
      }
      return this.upsert(merged)
    },

    clear(userId) {
      if (userId) store.delete(userId)
      else store.clear()
    },

    purgeExpired() {
      let removed = 0
      for (const [id, profile] of store) {
        if (isExpired(profile.expiresAt, clock())) {
          store.delete(id)
          removed += 1
        }
      }
      return removed
    },

    size() {
      this.purgeExpired()
      return store.size
    },
  }
}

function mergeFamily(
  current: FamilyMember[],
  incoming: FamilyMember[],
): FamilyMember[] {
  const out = current.map((m) => ({ ...m }))
  for (const m of incoming) {
    if (!out.some((x) => x.label.toLowerCase() === m.label.toLowerCase())) {
      out.push({ ...m })
    }
  }
  return out
}

function uniqueEnum<T extends string>(values: T[]): T[] {
  return [...new Set(values)]
}

let defaultStore: UserPreferenceStoreHandle | null = null

export function getUserPreferenceStore(
  options?: UserPreferenceStoreOptions,
): UserPreferenceStoreHandle {
  if (!defaultStore) defaultStore = UserPreferenceStore(options)
  return defaultStore
}

export function resetUserPreferenceStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
