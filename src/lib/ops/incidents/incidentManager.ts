/**
 * Phase AA — incident lifecycle manager.
 */

import { maskMetadata, maskEmail } from '../logging/mask'
import type { AlertEvent } from '../alerting/types'
import { getIncidentRepository, type CreateIncidentInput, type IncidentRepository } from './incidentRepository'
import {
  canTransitionIncidentStatus,
  type IncidentRecord,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentTimelineEntry,
} from './types'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `inc_${crypto.randomUUID()}`
  }
  return `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function maskFreeTextPII(text: string): string {
  return text.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    (email) => maskEmail(email),
  )
}
function timelineEntry(
  status: IncidentStatus,
  note: string,
  actor: string | null = null,
): IncidentTimelineEntry {
  return {
    id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: nowIso(),
    status,
    actor,
    note,
  }
}

export class IncidentManager {
  private readonly repository: IncidentRepository

  constructor(repository: IncidentRepository = getIncidentRepository()) {
    this.repository = repository
  }

  create(input: CreateIncidentInput): IncidentRecord {
    const now = nowIso()
    const record: IncidentRecord = {
      id: generateId(),
      title: input.title.trim() || 'Untitled incident',
      severity: input.severity,
      status: 'detected',
      affectedServices: [...(input.affectedServices ?? [])],
      detectedAt: now,
      owner: input.owner ?? null,
      customerImpact: input.customerImpact ?? null,
      mitigation: null,
      rootCause: null,
      resolution: null,
      followUpActions: [],
      correlationId: input.correlationId ?? null,
      alertConditionId: input.alertConditionId ?? null,
      timeline: [timelineEntry('detected', 'Incident detected')],
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    }
    if (input.dedupeKey) {
      record.alertConditionId = input.dedupeKey
    }
    return this.repository.create(record)
  }

  createFromAlert(alert: AlertEvent): IncidentRecord {
    return this.create({
      title: alert.title,
      severity: alert.severity as IncidentSeverity,
      affectedServices: alert.affectedServices as IncidentRecord['affectedServices'],
      correlationId: alert.correlationId ?? null,
      alertConditionId: alert.conditionId,
      customerImpact: alert.message,
      dedupeKey: alert.conditionId,
    })
  }

  transition(
    id: string,
    to: IncidentStatus,
    note: string,
    actor: string | null = null,
    patch: Partial<Pick<IncidentRecord, 'mitigation' | 'rootCause' | 'resolution' | 'owner' | 'followUpActions'>> = {},
  ): IncidentRecord {
    const current = this.repository.get(id)
    if (!current) throw new Error(`Incident not found: ${id}`)
    if (!canTransitionIncidentStatus(current.status, to)) {
      throw new Error(`Invalid incident transition ${current.status} → ${to}`)
    }
    const updated = this.repository.update(id, {
      status: to,
      owner: patch.owner ?? current.owner,
      mitigation: patch.mitigation ?? current.mitigation,
      rootCause: patch.rootCause ?? current.rootCause,
      resolution: patch.resolution ?? current.resolution,
      followUpActions: patch.followUpActions ?? current.followUpActions,
      closedAt: to === 'closed' ? nowIso() : current.closedAt,
      timeline: [
        ...current.timeline,
        timelineEntry(to, note, actor),
      ],
    })
    if (!updated) throw new Error(`Failed to update incident ${id}`)
    return updated
  }

  get(id: string): IncidentRecord | null {
    return this.repository.get(id)
  }

  listOpen(): IncidentRecord[] {
    return this.repository.listOpen()
  }

  /** Redacted view safe for support tooling. */
  toSupportView(record: IncidentRecord): Record<string, unknown> {
    return maskMetadata({
      id: record.id,
      title: record.title,
      severity: record.severity,
      status: record.status,
      affectedServices: record.affectedServices,
      detectedAt: record.detectedAt,
      owner: record.owner,
      customerImpact: record.customerImpact
        ? maskFreeTextPII(record.customerImpact)
        : null,
      mitigation: record.mitigation,
      resolution: record.resolution,
      correlationId: record.correlationId,
      timelineCount: record.timeline.length,
    })
  }
}

let defaultManager: IncidentManager | null = null

export function getIncidentManager(): IncidentManager {
  if (!defaultManager) defaultManager = new IncidentManager()
  return defaultManager
}

export function resetIncidentManager(): void {
  defaultManager = null
}
