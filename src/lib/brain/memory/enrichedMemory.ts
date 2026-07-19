/**
 * Sprint 28 — enrich ConversationMemory with extended preference slots.
 * Additive: existing ConversationMemory fields remain authoritative.
 */

import {
  ConversationMemoryApi,
  createEmptyMemory,
} from '../conversationMemory'
import type { BrainLocale, ConversationMemory } from '../types'
import { emptyPassportNationality } from './privacy'
import type {
  ConversationMemoryExtensions,
  EnrichedConversationMemory,
  FamilyMember,
  LoyaltyProgramEntry,
  MealPreference,
  SeatPreference,
  VisaStatus,
} from './types'

export function emptyExtensions(): ConversationMemoryExtensions {
  return {
    familyMembers: [],
    passportNationality: emptyPassportNationality(),
    seatPreferences: [],
    mealPreferences: [],
    accessibilityRequirements: [],
    loyaltyPrograms: [],
    visaStatus: null,
  }
}

export function enrichMemory(
  memory: ConversationMemory,
  extensions?: Partial<ConversationMemoryExtensions>,
): EnrichedConversationMemory {
  const base = ConversationMemoryApi.clone(memory)
  const ext = emptyExtensions()
  return {
    ...base,
    familyMembers: extensions?.familyMembers
      ? cloneFamily(extensions.familyMembers)
      : ext.familyMembers,
    passportNationality: extensions?.passportNationality
      ? { ...extensions.passportNationality }
      : ext.passportNationality,
    seatPreferences: extensions?.seatPreferences
      ? [...extensions.seatPreferences]
      : ext.seatPreferences,
    mealPreferences: extensions?.mealPreferences
      ? [...extensions.mealPreferences]
      : ext.mealPreferences,
    accessibilityRequirements: extensions?.accessibilityRequirements
      ? [...extensions.accessibilityRequirements]
      : ext.accessibilityRequirements,
    loyaltyPrograms: extensions?.loyaltyPrograms
      ? cloneLoyalty(extensions.loyaltyPrograms)
      : ext.loyaltyPrograms,
    visaStatus: extensions?.visaStatus ?? ext.visaStatus,
  }
}

export function createEmptyEnrichedMemory(
  conversationId?: string,
  locale: BrainLocale = 'ar',
): EnrichedConversationMemory {
  return enrichMemory(createEmptyMemory(conversationId, locale))
}

export function cloneEnrichedMemory(
  memory: EnrichedConversationMemory,
): EnrichedConversationMemory {
  return {
    ...ConversationMemoryApi.clone(memory),
    familyMembers: cloneFamily(memory.familyMembers ?? []),
    passportNationality: {
      ...(memory.passportNationality ?? emptyPassportNationality()),
    },
    seatPreferences: [...(memory.seatPreferences ?? [])],
    mealPreferences: [...(memory.mealPreferences ?? [])],
    accessibilityRequirements: [...(memory.accessibilityRequirements ?? [])],
    loyaltyPrograms: cloneLoyalty(memory.loyaltyPrograms ?? []),
    visaStatus: memory.visaStatus ?? null,
  }
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const t = v.trim()
    if (!t) continue
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out
}

function cloneFamily(members: FamilyMember[]): FamilyMember[] {
  return members.map((m) => ({ ...m }))
}

function cloneLoyalty(entries: LoyaltyProgramEntry[]): LoyaltyProgramEntry[] {
  return entries.map((e) => ({ ...e }))
}

function uniqueSeats(values: SeatPreference[]): SeatPreference[] {
  return [...new Set(values)]
}

function uniqueMeals(values: MealPreference[]): MealPreference[] {
  return [...new Set(values)]
}

/**
 * Merge enriched patches onto session memory without wiping answered slots.
 */
export function applyEnrichedPatch(
  base: EnrichedConversationMemory,
  patch: Partial<EnrichedConversationMemory>,
): EnrichedConversationMemory {
  const core = ConversationMemoryApi.applyPatch(base, patch)
  let next = enrichMemory(core, {
    familyMembers: base.familyMembers,
    passportNationality: base.passportNationality,
    seatPreferences: base.seatPreferences,
    mealPreferences: base.mealPreferences,
    accessibilityRequirements: base.accessibilityRequirements,
    loyaltyPrograms: base.loyaltyPrograms,
    visaStatus: base.visaStatus,
  })

  if (patch.familyMembers && patch.familyMembers.length > 0) {
    const merged = [...next.familyMembers]
    for (const m of patch.familyMembers) {
      if (!merged.some((x) => x.label.toLowerCase() === m.label.toLowerCase())) {
        merged.push({ ...m })
      }
    }
    next = { ...next, familyMembers: merged }
  }

  if (
    patch.passportNationality &&
    patch.passportNationality.explicitlyProvided === true
  ) {
    next = {
      ...next,
      passportNationality: {
        nationality:
          patch.passportNationality.nationality ??
          next.passportNationality.nationality,
        passportCountry:
          patch.passportNationality.passportCountry ??
          next.passportNationality.passportCountry,
        explicitlyProvided: true,
      },
    }
  }

  if (patch.seatPreferences && patch.seatPreferences.length > 0) {
    next = {
      ...next,
      seatPreferences: uniqueSeats([
        ...next.seatPreferences,
        ...patch.seatPreferences,
      ]),
    }
  }

  if (patch.mealPreferences && patch.mealPreferences.length > 0) {
    next = {
      ...next,
      mealPreferences: uniqueMeals([
        ...next.mealPreferences,
        ...patch.mealPreferences,
      ]),
    }
  }

  if (
    patch.accessibilityRequirements &&
    patch.accessibilityRequirements.length > 0
  ) {
    next = {
      ...next,
      accessibilityRequirements: uniqueStrings([
        ...next.accessibilityRequirements,
        ...patch.accessibilityRequirements,
      ]),
    }
  }

  if (patch.loyaltyPrograms && patch.loyaltyPrograms.length > 0) {
    const merged = cloneLoyalty(next.loyaltyPrograms)
    for (const entry of patch.loyaltyPrograms) {
      const idx = merged.findIndex(
        (x) => x.program.toLowerCase() === entry.program.toLowerCase(),
      )
      if (idx >= 0) {
        merged[idx] = {
          program: merged[idx].program,
          memberNumber: entry.memberNumber ?? merged[idx].memberNumber,
        }
      } else {
        merged.push({ ...entry })
      }
    }
    next = { ...next, loyaltyPrograms: merged }
  }

  if (patch.visaStatus) {
    next = { ...next, visaStatus: patch.visaStatus as VisaStatus }
    if (!next.visaRequirements) {
      next = { ...next, visaRequirements: patch.visaStatus }
    }
  }

  next = { ...next, updatedAt: new Date().toISOString() }
  return next
}

export function isEnrichedMemory(
  memory: ConversationMemory | EnrichedConversationMemory,
): memory is EnrichedConversationMemory {
  return (
    Array.isArray((memory as EnrichedConversationMemory).familyMembers) &&
    (memory as EnrichedConversationMemory).passportNationality != null
  )
}

export function ensureEnriched(
  memory: ConversationMemory | EnrichedConversationMemory,
): EnrichedConversationMemory {
  if (isEnrichedMemory(memory)) return cloneEnrichedMemory(memory)
  return enrichMemory(memory)
}
