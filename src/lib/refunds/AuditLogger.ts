/**
 * Sprint 36 — Policy engine audit logger.
 */

export interface PolicyAuditEntry {
  id: string
  at: string
  caseId: string | null
  tripId: string | null
  action: string
  detail: Record<string, unknown>
}

export class AuditLogger {
  private readonly entries: PolicyAuditEntry[] = []

  record(input: {
    caseId?: string | null
    tripId?: string | null
    action: string
    detail?: Record<string, unknown>
  }): PolicyAuditEntry {
    const entry: PolicyAuditEntry = {
      id: `raud_${Math.random().toString(36).slice(2, 10)}`,
      at: new Date().toISOString(),
      caseId: input.caseId ?? null,
      tripId: input.tripId ?? null,
      action: input.action,
      detail: input.detail ?? {},
    }
    this.entries.push(entry)
    return entry
  }

  list(caseId?: string): PolicyAuditEntry[] {
    if (!caseId) return [...this.entries]
    return this.entries.filter((e) => e.caseId === caseId)
  }

  clear(): void {
    this.entries.length = 0
  }
}
