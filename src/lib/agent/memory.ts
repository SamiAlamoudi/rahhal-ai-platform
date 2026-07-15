import type { ChatMessage } from '../chat/chatTypes'
import type { AgentMemory, AgentProviderMeta, TripRequirements } from './types'
import { emptyMemory, emptyRequirements } from './types'

export function isAgentProviderMeta(value: unknown): value is AgentProviderMeta {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return row.kind === 'travel_agent' && row.version === 1 && !!row.memory
}

export function memoryFromMeta(meta: Record<string, unknown> | null | undefined): AgentMemory | null {
  if (!isAgentProviderMeta(meta)) return null
  return meta.memory
}

export function mergeRequirements(
  base: TripRequirements,
  patch: Partial<TripRequirements>,
): TripRequirements {
  const destinations = patch.destinations && patch.destinations.length > 0
    ? uniqueStrings([...base.destinations, ...patch.destinations])
    : base.destinations

  const destination = patch.destination ?? base.destination ?? destinations[0] ?? null
  const interests = patch.interests && patch.interests.length > 0
    ? uniqueStrings([...base.interests, ...patch.interests])
    : base.interests

  return {
    destination,
    destinations: destination && !destinations.includes(destination)
      ? [destination, ...destinations]
      : destinations.length > 0
        ? destinations
        : destination
          ? [destination]
          : [],
    origin: patch.origin ?? base.origin,
    startDate: patch.startDate ?? base.startDate,
    endDate: patch.endDate ?? base.endDate,
    durationDays: patch.durationDays ?? base.durationDays,
    travelers: patch.travelers ?? base.travelers,
    travelerType: patch.travelerType ?? base.travelerType,
    budgetAmount: patch.budgetAmount ?? base.budgetAmount,
    budgetCurrency: patch.budgetCurrency ?? base.budgetCurrency,
    interests,
    notes: patch.notes ?? base.notes,
  }
}

export function missingRequirementFields(requirements: TripRequirements): Array<keyof TripRequirements> {
  const missing: Array<keyof TripRequirements> = []
  if (!requirements.destination && requirements.destinations.length === 0) missing.push('destination')
  if (requirements.durationDays == null && (!requirements.startDate || !requirements.endDate)) {
    missing.push('durationDays')
  }
  return missing
}

export function rebuildMemoryFromMessages(
  messages: ChatMessage[],
  fallbackLocale: AgentMemory['locale'] = 'ar',
): AgentMemory {
  let memory = emptyMemory(fallbackLocale)
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    const fromMeta = memoryFromMeta(message.providerMeta)
    if (fromMeta) memory = fromMeta
  }
  if (!memory.requirements) memory.requirements = emptyRequirements()
  memory.missingFields = missingRequirementFields(memory.requirements)
  return memory
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(value.trim())
  }
  return out
}
