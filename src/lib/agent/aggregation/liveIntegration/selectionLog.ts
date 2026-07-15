/**
 * Phase W — structured provider selection / fallback audit logs.
 */

export type SelectionLogLevel = 'info' | 'warn' | 'error'

export interface ProviderSelectionLogEntry {
  id: string
  at: string
  level: SelectionLogLevel
  domain: string
  event: string
  message: string
  providerId: string | null
  strategy: string | null
  metadata: Record<string, unknown>
}

export interface ProviderSelectionLog {
  append(entry: Omit<ProviderSelectionLogEntry, 'id' | 'at'> & { at?: string }): ProviderSelectionLogEntry
  list(limit?: number): ProviderSelectionLogEntry[]
  clear(): void
}

function id(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `psel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function createProviderSelectionLog(maxEntries = 500): ProviderSelectionLog {
  const entries: ProviderSelectionLogEntry[] = []

  return {
    append(input) {
      const entry: ProviderSelectionLogEntry = {
        id: id(),
        at: input.at ?? new Date().toISOString(),
        level: input.level,
        domain: input.domain,
        event: input.event,
        message: input.message,
        providerId: input.providerId,
        strategy: input.strategy,
        metadata: { ...input.metadata },
      }
      entries.push(entry)
      if (entries.length > maxEntries) {
        entries.splice(0, entries.length - maxEntries)
      }
      return entry
    },
    list(limit = 100) {
      return entries.slice(-limit).map((e) => ({ ...e, metadata: { ...e.metadata } }))
    },
    clear() {
      entries.length = 0
    },
  }
}
