/**
 * Sprint 28 — privacy-safe boundaries for conversation memory.
 * Passport numbers / membership IDs never appear in summaries or logs.
 */

import type {
  EnrichedConversationMemory,
  FamilyMember,
  LoyaltyProgramEntry,
  PassportNationalitySlot,
  TravelPreferenceProfile,
} from './types'

const SENSITIVE_KEY =
  /passport|national.?id|member.?number|loyalty.?number|ssn|card|cvv|password|secret|token/i

export function emptyPassportNationality(): PassportNationalitySlot {
  return {
    nationality: null,
    passportCountry: null,
    explicitlyProvided: false,
  }
}

export function maskSensitiveValue(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.length <= 4) return '****'
  return `${value.slice(0, 1)}***${value.slice(-2)}`
}

export function redactLoyaltyForPublic(
  entries: LoyaltyProgramEntry[],
): Array<{ program: string; memberNumber: string | null }> {
  return entries.map((e) => ({
    program: e.program,
    memberNumber: e.memberNumber ? maskSensitiveValue(e.memberNumber) : null,
  }))
}

/** Strip membership numbers and passport details for summaries / logs. */
export function sanitizeMemoryForPublic(
  memory: EnrichedConversationMemory,
): Record<string, unknown> {
  return {
    conversationId: memory.conversationId,
    destination: memory.destination,
    destinations: [...memory.destinations],
    origin: memory.origin,
    budget: { ...memory.budget },
    travelDates: { ...memory.travelDates },
    travelers: { ...memory.travelers },
    cabinClass: memory.cabinClass,
    airlinePreferences: [...memory.airlinePreferences],
    hotelPreferences: [...memory.hotelPreferences],
    hotelRequirement: memory.hotelRequirement,
    activities: [...memory.activities],
    visaRequirements: memory.visaRequirements,
    visaStatus: memory.visaStatus,
    conversationLanguage: memory.conversationLanguage,
    currency: memory.currency,
    familyMembers: memory.familyMembers.map((m) => ({
      label: m.label,
      relation: m.relation,
      age: m.age,
    })),
    passportNationality: memory.passportNationality.explicitlyProvided
      ? {
          nationality: memory.passportNationality.nationality,
          passportCountry: memory.passportNationality.passportCountry,
          explicitlyProvided: true,
        }
      : { nationality: null, passportCountry: null, explicitlyProvided: false },
    seatPreferences: [...memory.seatPreferences],
    mealPreferences: [...memory.mealPreferences],
    accessibilityRequirements: [...memory.accessibilityRequirements],
    loyaltyPrograms: redactLoyaltyForPublic(memory.loyaltyPrograms),
    askedFields: [...memory.askedFields],
    answeredFields: [...memory.answeredFields],
    updatedAt: memory.updatedAt,
  }
}

export function sanitizeProfileForPublic(
  profile: TravelPreferenceProfile,
): Record<string, unknown> {
  return {
    userId: profile.userId ? `${profile.userId.slice(0, 2)}***` : null,
    preferredAirlines: [...profile.preferredAirlines],
    preferredHotelBrands: [...profile.preferredHotelBrands],
    cabinClass: profile.cabinClass,
    budgetRange: { ...profile.budgetRange },
    typicalTravelerCount: profile.typicalTravelerCount,
    familyMembers: profile.familyMembers.map((m: FamilyMember) => ({
      label: m.label,
      relation: m.relation,
      age: m.age,
    })),
    nationality: profile.allowSensitiveRetention ? profile.nationality : null,
    visaStatus: profile.visaStatus,
    seatPreferences: [...profile.seatPreferences],
    mealPreferences: [...profile.mealPreferences],
    accessibilityRequirements: [...profile.accessibilityRequirements],
    loyaltyPrograms: [...profile.loyaltyPrograms],
    updatedAt: profile.updatedAt,
    expiresAt: profile.expiresAt,
  }
}

export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = '[redacted]'
      continue
    }
    out[key] = value
  }
  return out
}

/**
 * Long-term store must never persist passport numbers or loyalty member IDs.
 * Nationality is allowed only when allowSensitiveRetention is true.
 */
export function toLongTermSafeProfile(
  profile: TravelPreferenceProfile,
): TravelPreferenceProfile {
  return {
    ...profile,
    nationality: profile.allowSensitiveRetention ? profile.nationality : null,
    loyaltyPrograms: profile.loyaltyPrograms.map((p) => p.trim()).filter(Boolean),
    familyMembers: profile.familyMembers.map((m) => ({
      label: m.label,
      relation: m.relation,
      age: m.age,
    })),
  }
}
