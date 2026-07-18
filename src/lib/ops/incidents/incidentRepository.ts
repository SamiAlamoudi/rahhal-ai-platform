/**
 * Phase AA — in-memory incident repository.
 */

import type { IncidentRecord } from './types'

export interface CreateIncidentInput {
  title: string
  severity: IncidentRecord['severity']
  affectedServices?: IncidentRecord['affectedServices']
  owner?: string | null
  customerImpact?: string | null
  correlationId?: string | null
  alertConditionId?: string | null
  dedupeKey?: string | null
}

export class IncidentRepository {
  private readonly incidents = new Map<string, IncidentRecord>()
  private readonly dedupeIndex = new Map<string, string>()

  create(record: IncidentRecord): IncidentRecord {
    if (record.alertConditionId) {
      const key = record.correlationId
        ? `${record.alertConditionId}:${record.correlationId}`
        : record.alertConditionId
      const existingId = this.dedupeIndex.get(key)
      if (existingId) {
        const existing = this.incidents.get(existingId)
        if (existing && existing.status !== 'closed') return existing
      }
      this.dedupeIndex.set(key, record.id)
    }
    this.incidents.set(record.id, structuredClone(record))
    return this.get(record.id)!
  }

  get(id: string): IncidentRecord | null {
    const row = this.incidents.get(id)
    return row ? structuredClone(row) : null
  }

  listOpen(): IncidentRecord[] {
    return [...this.incidents.values()]
      .filter((i) => i.status !== 'closed')
      .map((i) => structuredClone(i))
  }

  listAll(): IncidentRecord[] {
    return [...this.incidents.values()].map((i) => structuredClone(i))
  }

  update(id: string, patch: Partial<IncidentRecord>): IncidentRecord | null {
    const current = this.incidents.get(id)
    if (!current) return null
    const next: IncidentRecord = {
      ...current,
      ...patch,
      id: current.id,
      timeline: patch.timeline ?? current.timeline,
      followUpActions: patch.followUpActions ?? current.followUpActions,
      updatedAt: new Date().toISOString(),
    }
    this.incidents.set(id, structuredClone(next))
    return this.get(id)
  }

  clear(): void {
    this.incidents.clear()
    this.dedupeIndex.clear()
  }
}

let defaultRepo: IncidentRepository | null = null

export function getIncidentRepository(): IncidentRepository {
  if (!defaultRepo) defaultRepo = new IncidentRepository()
  return defaultRepo
}

export function resetIncidentRepository(): void {
  defaultRepo?.clear()
  defaultRepo = null
}
