/**
 * Sprint 69 — Incident management helpers (composes IncidentManager).
 */

import { evaluateAlertRules, DEFAULT_ALERT_RULES } from '../alerting'
import { getIncidentManager, resetIncidentManager } from '../incidents'
import type { IncidentRecord, IncidentSeverity } from '../incidents'
import { collectMonitoringSnapshot } from '../observability/monitoring'
import type { OpsIncidentReport } from './types'

export function createOpsIncident(input: {
  title: string
  severity: IncidentSeverity
  affectedServices?: IncidentRecord['affectedServices']
  customerImpact?: string
  owner?: string
}): IncidentRecord {
  return getIncidentManager().create({
    title: input.title,
    severity: input.severity,
    affectedServices: input.affectedServices,
    customerImpact: input.customerImpact,
    owner: input.owner,
  })
}

export function appendIncidentRecovery(
  incidentId: string,
  note: string,
  actor: string | null = 'ops',
): IncidentRecord {
  const mgr = getIncidentManager()
  const current = mgr.get(incidentId)
  if (!current) throw new Error(`Incident not found: ${incidentId}`)

  const progression: Array<IncidentRecord['status']> = [
    'detected',
    'investigating',
    'identified',
    'mitigating',
    'resolved',
    'closed',
  ]
  const idx = progression.indexOf(current.status)
  const next = progression[Math.min(idx + 1, progression.length - 1)]!
  if (next === current.status) {
    return mgr.transition(incidentId, 'investigating', note, actor, { mitigation: note })
  }
  return mgr.transition(incidentId, next, note, actor, {
    mitigation: note,
  })
}

export function resolveOpsIncident(
  incidentId: string,
  resolution: string,
  actor: string | null = 'ops',
): IncidentRecord {
  const mgr = getIncidentManager()
  const current = mgr.get(incidentId)
  if (!current) throw new Error(`Incident not found: ${incidentId}`)
  let record = current
  if (record.status === 'detected') {
    record = mgr.transition(incidentId, 'investigating', 'Auto-advance to investigate', actor)
  }
  if (record.status === 'investigating') {
    record = mgr.transition(incidentId, 'identified', 'Root cause identified', actor, {
      rootCause: resolution,
    })
  }
  if (record.status === 'identified') {
    record = mgr.transition(incidentId, 'mitigating', 'Mitigation in progress', actor)
  }
  if (record.status === 'mitigating') {
    record = mgr.transition(incidentId, 'resolved', 'Resolved', actor, { resolution })
  }
  if (record.status === 'resolved') {
    record = mgr.transition(incidentId, 'closed', 'Closed after resolution', actor, { resolution })
  }
  return record
}

export function buildOpsIncidentReport(incidentId: string): OpsIncidentReport {
  const record = getIncidentManager().get(incidentId)
  if (!record) throw new Error(`Incident not found: ${incidentId}`)

  const postmortemTemplate = [
    `# Postmortem — ${record.title}`,
    '',
    `**Incident ID:** ${record.id}`,
    `**Severity:** ${record.severity}`,
    `**Detected:** ${record.detectedAt}`,
    '',
    '## Impact',
    record.customerImpact ?? '_TBD_',
    '',
    '## Timeline',
    ...record.timeline.map((t) => `- ${t.at} — ${t.status}: ${t.note}`),
    '',
    '## Root cause',
    record.rootCause ?? '_TBD_',
    '',
    '## Resolution',
    record.resolution ?? '_TBD_',
    '',
    '## Follow-ups',
    ...(record.followUpActions.length
      ? record.followUpActions.map((a) => `- ${a}`)
      : ['- _TBD_']),
    '',
  ].join('\n')

  return {
    incidentId: record.id,
    title: record.title,
    severity: record.severity,
    status: record.status,
    timeline: record.timeline.map((t) => ({
      at: t.at,
      status: t.status,
      note: t.note,
    })),
    recoveryLog: record.timeline
      .filter((t) => t.status === 'mitigating' || t.status === 'investigating')
      .map((t) => t.note),
    resolution: record.resolution,
    postmortemTemplate,
    generatedAt: new Date().toISOString(),
  }
}

/** Promote current production alerts into incidents when critical/high. */
export function syncAlertsToIncidents(): IncidentRecord[] {
  const snapshot = collectMonitoringSnapshot()
  const alerts = evaluateAlertRules(snapshot, DEFAULT_ALERT_RULES)
  const mgr = getIncidentManager()
  const created: IncidentRecord[] = []
  for (const alert of alerts) {
    if (alert.severity === 'critical' || alert.severity === 'high') {
      created.push(mgr.createFromAlert(alert))
    }
  }
  return created
}

export function listOpenOpsIncidents(): IncidentRecord[] {
  return getIncidentManager().listOpen()
}

export { resetIncidentManager }
