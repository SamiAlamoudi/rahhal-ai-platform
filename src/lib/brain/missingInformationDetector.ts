import type { BrainMemorySlot, ConversationMemory, TravelIntent } from './types'

/** Intake order for slot filling — ask only what's missing, never twice. */
export const BRAIN_INTAKE_ORDER: BrainMemorySlot[] = [
  'destination',
  'origin',
  'travelDates',
  'travelers',
  'budget',
  'currency',
  'cabinClass',
  'airlinePreferences',
  'hotelRequirement',
  'hotelPreferences',
  'activities',
  'visaRequirements',
]

const INTENT_REQUIRED: Partial<Record<TravelIntent, BrainMemorySlot[]>> = {
  SearchFlights: ['destination', 'travelDates', 'travelers'],
  SearchHotels: ['destination', 'travelDates', 'travelers'],
  SearchPackages: ['destination', 'travelDates', 'travelers', 'budget'],
  AskRecommendation: ['destination'],
  BudgetPlanning: ['destination', 'budget'],
  VisaQuestion: ['destination'],
  WeatherQuestion: ['destination'],
  PackingAdvice: ['destination', 'travelDates'],
  TravelAdvice: ['destination'],
  ModifyTrip: [],
  CancelBooking: [],
  ContinueBooking: [],
  GeneralConversation: ['destination'],
}

/** Sprint 21 — extra domain slots when travel conversation engine is on. */
const DOMAIN_EXTRA: Partial<Record<TravelIntent, BrainMemorySlot[]>> = {
  SearchFlights: ['origin'],
  SearchHotels: ['hotelRequirement'],
  SearchPackages: ['origin', 'hotelRequirement'],
  AskRecommendation: ['travelDates'],
  GeneralConversation: ['travelDates'],
  TravelAdvice: ['travelDates'],
}

function isFilled(memory: ConversationMemory, slot: BrainMemorySlot): boolean {
  switch (slot) {
    case 'destination':
      return Boolean(memory.destination || memory.destinations.length > 0)
    case 'origin':
      return Boolean(memory.origin)
    case 'budget':
      return memory.budget.amount != null || memory.budget.flexible
    case 'travelDates':
      return (
        memory.travelDates.durationDays != null ||
        Boolean(memory.travelDates.startDate && memory.travelDates.endDate) ||
        Boolean(memory.travelDates.startDate) ||
        memory.travelDates.flexible
      )
    case 'travelers':
      return (
        memory.travelers.count != null ||
        memory.travelers.adults != null ||
        ((memory.travelers.children ?? 0) + (memory.travelers.infants ?? 0) > 0)
      )
    case 'cabinClass':
      return memory.cabinClass != null
    case 'airlinePreferences':
      return memory.airlinePreferences.length > 0
    case 'hotelPreferences':
      return memory.hotelPreferences.length > 0
    case 'hotelRequirement':
      return memory.hotelRequirement !== null
    case 'activities':
      return memory.activities.length > 0
    case 'visaRequirements':
      return memory.visaRequirements != null
    case 'conversationLanguage':
      return true
    case 'currency':
      return memory.currency != null || memory.budget.currency != null
    default:
      return false
  }
}

/**
 * MissingInformationDetector — slot filling with never-ask-twice semantics.
 * When domainSlots is true (Sprint 21 travel engine), include origin / hotel need.
 */
export function MissingInformationDetector(input: {
  memory: ConversationMemory
  intent: TravelIntent
  /** Sprint 21 — require domain slots for real travel search readiness. */
  domainSlots?: boolean
}): BrainMemorySlot[] {
  const base = INTENT_REQUIRED[input.intent] ?? ['destination']
  const extra = input.domainSlots ? (DOMAIN_EXTRA[input.intent] ?? []) : []
  const required = [...base]
  for (const slot of extra) {
    if (!required.includes(slot)) required.push(slot)
  }

  const missing: BrainMemorySlot[] = []

  for (const slot of BRAIN_INTAKE_ORDER) {
    if (!required.includes(slot)) continue
    if (isFilled(input.memory, slot)) continue
    // Never ask twice.
    if (input.memory.askedFields.includes(slot)) continue
    missing.push(slot)
  }

  return missing
}

export function nextFieldToAsk(missing: BrainMemorySlot[]): BrainMemorySlot | null {
  return missing[0] ?? null
}

export function isMemorySlotFilled(
  memory: ConversationMemory,
  slot: BrainMemorySlot,
): boolean {
  return isFilled(memory, slot)
}
