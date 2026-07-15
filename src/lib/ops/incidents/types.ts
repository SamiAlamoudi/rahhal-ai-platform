/**
 * Phase AA — incident tracking types.
 */

import type { AffectedService } from '../observability/monitoring'

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low'

export type IncidentStatus =
  | 'detected'
  | 'investigating'
  | 'identified'
  | 'mitigating'
  | 'resolved'
  | 'closed'

export interface IncidentTimelineEntry {
  id: string
  at: string
  status: IncidentStatus
  actor: string | null
  note: string
}

export interface IncidentRecord {
  id: string
  title: string
  severity: IncidentSeverity
  status: IncidentStatus
  affectedServices: AffectedService[]
  detectedAt: string
  owner: string | null
  customerImpact: string | null
  mitigation: string | null
  rootCause: string | null
  resolution: string | null
  followUpActions: string[]
  correlationId: string | null
  alertConditionId: string | null
  timeline: IncidentTimelineEntry[]
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export const INCIDENT_STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  detected: ['investigating', 'closed'],
  investigating: ['identified', 'mitigating', 'resolved', 'closed'],
  identified: ['mitigating', 'resolved', 'closed'],
  mitigating: ['resolved', 'closed'],
  resolved: ['closed', 'investigating'],
  closed: [],
}

export function canTransitionIncidentStatus(from: IncidentStatus, to: IncidentStatus): boolean {
  return INCIDENT_STATUS_TRANSITIONS[from].includes(to)
}
