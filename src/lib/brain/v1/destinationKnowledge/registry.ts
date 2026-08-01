/**
 * Destination Knowledge registry.
 * Insert new DestinationKnowledge records via registerDestinationKnowledge — no planner edits.
 */

import type { DestinationKnowledge } from './types'

const byKey = new Map<string, DestinationKnowledge>()
const aliasToKey = new Map<string, string>()

function normalizeAlias(raw: string): string {
  return raw.trim().toLowerCase()
}

export function registerDestinationKnowledge(record: DestinationKnowledge): void {
  byKey.set(record.key, record)
  // Later registrations win (city overlays like Agadir after Morocco).
  for (const alias of [record.key, record.displayNameEn, record.displayNameAr, ...record.aliases]) {
    aliasToKey.set(normalizeAlias(alias), record.key)
  }
  for (const city of record.cities) {
    for (const alias of [city.key, city.nameEn, city.nameAr, ...(city.aliases ?? [])]) {
      const normalized = normalizeAlias(alias)
      // Do not let a country steal a more specific city key already registered.
      const existing = aliasToKey.get(normalized)
      if (existing && existing !== record.key && getDestinationKnowledgeByKey(existing)?.kind === 'city') {
        continue
      }
      aliasToKey.set(normalized, record.key)
    }
  }
}

export function registerDestinationKnowledgeMany(records: DestinationKnowledge[]): void {
  for (const record of records) registerDestinationKnowledge(record)
}

export function getDestinationKnowledgeByKey(key: string): DestinationKnowledge | null {
  return byKey.get(key) ?? null
}

export function listDestinationKnowledge(): DestinationKnowledge[] {
  return [...byKey.values()]
}

/** Resolve free text / entity destination to a knowledge key. */
export function resolveDestinationKnowledgeKey(text?: string | null): string | null {
  if (!text?.trim()) return null
  const lower = text.trim().toLowerCase()
  const direct = aliasToKey.get(lower)
  if (direct) return direct
  // Substring match longest alias first for phrases like "Business trip London".
  const aliases = [...aliasToKey.keys()].sort((a, b) => b.length - a.length)
  for (const alias of aliases) {
    if (alias.length >= 3 && lower.includes(alias)) return aliasToKey.get(alias) ?? null
  }
  return null
}

export function clearDestinationKnowledgeRegistryForTests(): void {
  byKey.clear()
  aliasToKey.clear()
}
