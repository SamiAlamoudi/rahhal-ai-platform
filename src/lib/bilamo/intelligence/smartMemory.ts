/**
 * Smart Memory — never ask twice; retain consultant preferences across turns.
 */

import type { AgentMemory, AgentLocale, TripRequirements } from '../../agent/types'
import { emptyMemory } from '../../agent/types'
import { memoryFromMeta, rebuildMemoryFromMessages } from '../../agent/memory'
import type { ChatMessage } from '../../chat/chatTypes'
import type { BilamoConsultantMemory, BilamoHardSlot, BilamoPhase } from './types'

export function emptyBilamoMemory(locale: AgentLocale = 'en'): BilamoConsultantMemory {
  return {
    locale,
    phase: 'greeting',
    agent: emptyMemory(locale),
    askedSlots: [],
    preferences: {
      origin: null,
      preferredAirline: null,
      seatClass: null,
      hotelPreference: null,
      budgetRange: null,
      partyStyle: null,
    },
  }
}

function collectAskedSlotsFromMessages(messages: ChatMessage[]): BilamoHardSlot[] {
  const asked = new Set<BilamoHardSlot>()
  for (const message of messages) {
    const bilamo = (message.providerMeta as { bilamo?: {
      askedSlots?: BilamoHardSlot[]
      askedSlot?: BilamoHardSlot | null
    } } | null | undefined)?.bilamo
    if (!bilamo) continue
    for (const slot of bilamo.askedSlots ?? []) {
      if (slot) asked.add(slot)
    }
    if (bilamo.askedSlot) asked.add(bilamo.askedSlot)
  }
  return [...asked]
}

export function hydrateBilamoMemory(input: {
  messages: ChatMessage[]
  prior?: BilamoConsultantMemory | null
  locale?: AgentLocale
}): BilamoConsultantMemory {
  const locale = input.locale ?? input.prior?.locale ?? 'en'
  const fromHistory = rebuildMemoryFromMessages(input.messages)
  const base = input.prior ?? emptyBilamoMemory(locale)

  // Prefer last assistant meta memory when present.
  let agent: AgentMemory = fromHistory
  for (let i = input.messages.length - 1; i >= 0; i -= 1) {
    const meta = memoryFromMeta(input.messages[i]?.providerMeta ?? null)
    if (meta) {
      agent = meta
      break
    }
  }

  // Merge askedSlots from prior + every assistant bilamo meta (survives reload).
  const askedSlots = [
    ...new Set<BilamoHardSlot>([
      ...base.askedSlots,
      ...collectAskedSlotsFromMessages(input.messages),
    ]),
  ]

  const req = agent.requirements
  return {
    locale: agent.locale || locale,
    phase: mapPhase(agent.phase, req),
    agent: {
      ...agent,
      locale: agent.locale || locale,
    },
    askedSlots,
    preferences: {
      origin: req.origin ?? base.preferences.origin,
      preferredAirline: req.preferredAirline ?? base.preferences.preferredAirline,
      seatClass: req.cabinPreference ?? base.preferences.seatClass,
      hotelPreference: req.hotelPreference ?? base.preferences.hotelPreference,
      budgetRange:
        req.budgetAmount != null
          ? { amount: req.budgetAmount, currency: req.budgetCurrency || 'SAR' }
          : base.preferences.budgetRange,
      partyStyle: req.travelerType ?? base.preferences.partyStyle,
    },
  }
}

function mapPhase(
  phase: AgentMemory['phase'],
  req: TripRequirements,
): BilamoPhase {
  if (phase === 'planned' || phase === 'editing') return 'recommending'
  if (!req.destination && req.destinations.length === 0 && !req.destinationFlexible) {
    return 'greeting'
  }
  return 'collecting'
}

export function rememberAsked(
  memory: BilamoConsultantMemory,
  slot: BilamoHardSlot | null,
): BilamoConsultantMemory {
  if (!slot || memory.askedSlots.includes(slot)) return memory
  return { ...memory, askedSlots: [...memory.askedSlots, slot] }
}

export function applyPreferencesToRequirements(
  req: TripRequirements,
  prefs: BilamoConsultantMemory['preferences'],
): TripRequirements {
  return {
    ...req,
    origin: req.origin ?? prefs.origin,
    preferredAirline: req.preferredAirline ?? prefs.preferredAirline,
    cabinPreference: req.cabinPreference ?? prefs.seatClass,
    hotelPreference: req.hotelPreference ?? prefs.hotelPreference,
    travelerType: req.travelerType ?? prefs.partyStyle,
    budgetAmount: req.budgetAmount ?? prefs.budgetRange?.amount ?? null,
    budgetCurrency: req.budgetCurrency ?? prefs.budgetRange?.currency ?? null,
  }
}

export function syncPreferencesFromRequirements(
  memory: BilamoConsultantMemory,
  req: TripRequirements,
): BilamoConsultantMemory {
  return {
    ...memory,
    preferences: {
      origin: req.origin ?? memory.preferences.origin,
      preferredAirline: req.preferredAirline ?? memory.preferences.preferredAirline,
      seatClass: req.cabinPreference ?? memory.preferences.seatClass,
      hotelPreference: req.hotelPreference ?? memory.preferences.hotelPreference,
      budgetRange:
        req.budgetAmount != null
          ? { amount: req.budgetAmount, currency: req.budgetCurrency || 'SAR' }
          : memory.preferences.budgetRange,
      partyStyle: req.travelerType ?? memory.preferences.partyStyle,
    },
  }
}
