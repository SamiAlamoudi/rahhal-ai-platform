import type {
  BrainLocale,
  BrainMemorySlot,
  BudgetSlot,
  CabinClass,
  ConversationMemory,
  TravelerSlot,
  TravelDates,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function emptyBudget(): BudgetSlot {
  return { amount: null, currency: null, flexible: false }
}

export function emptyTravelDates(): TravelDates {
  return { startDate: null, endDate: null, durationDays: null, flexible: false }
}

export function emptyTravelers(): TravelerSlot {
  return { count: null, adults: null, children: null, infants: null }
}

export function createEmptyMemory(
  conversationId = newId('brain'),
  locale: BrainLocale = 'ar',
): ConversationMemory {
  return {
    conversationId,
    destination: null,
    destinations: [],
    origin: null,
    budget: emptyBudget(),
    travelDates: emptyTravelDates(),
    travelers: emptyTravelers(),
    cabinClass: null,
    airlinePreferences: [],
    hotelPreferences: [],
    hotelRequirement: null,
    activities: [],
    visaRequirements: null,
    conversationLanguage: locale,
    currency: null,
    askedFields: [],
    answeredFields: [],
    updatedAt: nowIso(),
  }
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (!out.some((v) => v.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed)
  }
  return out
}

function markAnswered(memory: ConversationMemory, slots: BrainMemorySlot[]): void {
  for (const slot of slots) {
    if (!memory.answeredFields.includes(slot)) memory.answeredFields.push(slot)
  }
}

/**
 * ConversationMemory helpers — remember slots, never wipe answered fields casually.
 */
export const ConversationMemoryApi = {
  create: createEmptyMemory,

  clone(memory: ConversationMemory): ConversationMemory {
    return {
      ...memory,
      destinations: [...memory.destinations],
      budget: { ...memory.budget },
      travelDates: { ...memory.travelDates },
      travelers: { ...memory.travelers },
      airlinePreferences: [...memory.airlinePreferences],
      hotelPreferences: [...memory.hotelPreferences],
      activities: [...memory.activities],
      askedFields: [...memory.askedFields],
      answeredFields: [...memory.answeredFields],
    }
  },

  applyPatch(
    base: ConversationMemory,
    patch: Partial<ConversationMemory>,
  ): ConversationMemory {
    const next = ConversationMemoryApi.clone(base)
    const answered: BrainMemorySlot[] = []

    if (patch.destination !== undefined && patch.destination) {
      next.destination = patch.destination
      answered.push('destination')
    }
    if (patch.destinations && patch.destinations.length > 0) {
      next.destinations = unique([...next.destinations, ...patch.destinations])
      next.destination = next.destination ?? next.destinations[0] ?? null
      answered.push('destination')
    }
    if (patch.origin !== undefined && patch.origin) {
      next.origin = patch.origin
      answered.push('origin')
    }
    if (patch.budget) {
      next.budget = {
        amount: patch.budget.amount ?? next.budget.amount,
        currency: patch.budget.currency ?? next.budget.currency,
        flexible: patch.budget.flexible || next.budget.flexible,
      }
      if (next.budget.amount != null || next.budget.flexible) answered.push('budget')
      if (next.budget.currency) {
        next.currency = next.currency ?? next.budget.currency
        answered.push('currency')
      }
    }
    if (patch.travelDates) {
      next.travelDates = {
        startDate: patch.travelDates.startDate ?? next.travelDates.startDate,
        endDate: patch.travelDates.endDate ?? next.travelDates.endDate,
        durationDays: patch.travelDates.durationDays ?? next.travelDates.durationDays,
        flexible: patch.travelDates.flexible || next.travelDates.flexible,
      }
      if (
        next.travelDates.startDate ||
        next.travelDates.endDate ||
        next.travelDates.durationDays != null ||
        next.travelDates.flexible
      ) {
        answered.push('travelDates')
      }
    }
    if (patch.travelers) {
      next.travelers = {
        count: patch.travelers.count ?? next.travelers.count,
        adults: patch.travelers.adults ?? next.travelers.adults,
        children: patch.travelers.children ?? next.travelers.children,
        infants: patch.travelers.infants ?? next.travelers.infants,
      }
      if (
        next.travelers.count != null ||
        next.travelers.adults != null ||
        next.travelers.children != null ||
        next.travelers.infants != null
      ) {
        const adults = next.travelers.adults ?? 0
        const children = next.travelers.children ?? 0
        const infants = next.travelers.infants ?? 0
        const summed = adults + children + infants
        if (summed > 0 && next.travelers.count == null) {
          next.travelers.count = summed
        }
        answered.push('travelers')
      }
    }
    if (patch.cabinClass) {
      next.cabinClass = patch.cabinClass as CabinClass
      answered.push('cabinClass')
    }
    if (patch.airlinePreferences && patch.airlinePreferences.length > 0) {
      next.airlinePreferences = unique([
        ...next.airlinePreferences,
        ...patch.airlinePreferences,
      ])
      answered.push('airlinePreferences')
    }
    if (patch.hotelPreferences && patch.hotelPreferences.length > 0) {
      next.hotelPreferences = unique([
        ...next.hotelPreferences,
        ...patch.hotelPreferences,
      ])
      answered.push('hotelPreferences')
    }
    if (patch.hotelRequirement !== undefined && patch.hotelRequirement !== null) {
      next.hotelRequirement = patch.hotelRequirement
      answered.push('hotelRequirement')
    }
    if (patch.activities && patch.activities.length > 0) {
      next.activities = unique([...next.activities, ...patch.activities])
      answered.push('activities')
    }
    if (patch.visaRequirements) {
      next.visaRequirements = patch.visaRequirements
      answered.push('visaRequirements')
    }
    if (patch.conversationLanguage) {
      next.conversationLanguage = patch.conversationLanguage
      answered.push('conversationLanguage')
    }
    if (patch.currency) {
      next.currency = patch.currency
      answered.push('currency')
    }

    markAnswered(next, answered)
    next.updatedAt = nowIso()
    return next
  },

  markAsked(memory: ConversationMemory, fields: BrainMemorySlot[]): ConversationMemory {
    const next = ConversationMemoryApi.clone(memory)
    for (const field of fields) {
      if (!next.askedFields.includes(field)) next.askedFields.push(field)
    }
    next.updatedAt = nowIso()
    return next
  },
}

export type { ConversationMemory }
