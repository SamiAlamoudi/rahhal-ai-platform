/**
 * Sprint 33 — Execution audit log.
 */

import type { ExecutionAuditEntry, ExecutionState } from './ExecutionTypes'

export class ExecutionAudit {
  private readonly entries: ExecutionAuditEntry[] = []

  record(
    action: string,
    state: ExecutionState,
    detail: Record<string, unknown> = {},
  ): ExecutionAuditEntry {
    const entry: ExecutionAuditEntry = {
      id: `aud_${Math.random().toString(36).slice(2, 9)}`,
      at: new Date().toISOString(),
      action,
      state,
      detail,
    }
    this.entries.push(entry)
    return entry
  }

  list(): ExecutionAuditEntry[] {
    return [...this.entries]
  }

  hydrate(entries: ExecutionAuditEntry[]): void {
    this.entries.length = 0
    this.entries.push(...entries)
  }
}
