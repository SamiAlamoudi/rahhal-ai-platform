/**
 * Sprint 41 — Finance audit trail.
 */

import type { FinanceAuditEntry } from './types'

export class AuditLogger {
  private readonly entries: FinanceAuditEntry[] = []

  log(
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, unknown> = {},
  ): FinanceAuditEntry {
    const entry: FinanceAuditEntry = {
      entryId: `faud_${this.entries.length + 1}`,
      action,
      entityType,
      entityId,
      details,
      at: new Date().toISOString(),
    }
    this.entries.push(entry)
    return { ...entry, details: { ...details } }
  }

  list(filter?: { entityId?: string; action?: string }): FinanceAuditEntry[] {
    return this.entries
      .filter((e) => {
        if (filter?.entityId && e.entityId !== filter.entityId) return false
        if (filter?.action && e.action !== filter.action) return false
        return true
      })
      .map((e) => ({ ...e, details: { ...e.details } }))
  }

  clear(): void {
    this.entries.length = 0
  }
}

export function createAuditLogger(): AuditLogger {
  return new AuditLogger()
}
