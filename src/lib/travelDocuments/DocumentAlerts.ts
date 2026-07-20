/**
 * Sprint 39 — Document expiration & reminder alerts.
 */

import type { DocumentAlert, TravelerDocumentProfile } from './types'

export class DocumentAlerts {
  build(profile: TravelerDocumentProfile, now = new Date()): DocumentAlert[] {
    const alerts: DocumentAlert[] = []
    const createdAt = now.toISOString()

    pushExpiry(alerts, {
      kind: 'passport_expiration',
      label: 'Passport',
      expiry: profile.passportExpiry,
      createdAt,
      now,
    })
    pushExpiry(alerts, {
      kind: 'visa_expiration',
      label: 'Visa',
      expiry: profile.visaExpiry,
      createdAt,
      now,
    })
    pushExpiry(alerts, {
      kind: 'residence_expiration',
      label: 'Residence permit',
      expiry: profile.residencePermitExpiry,
      createdAt,
      now,
    })

    for (const record of profile.vaccinationRecords ?? []) {
      if (!record.expiresAt) continue
      const days = daysUntil(record.expiresAt, now)
      if (days == null) continue
      if (days <= 60) {
        alerts.push({
          alertId: `al_${Math.random().toString(36).slice(2, 9)}`,
          kind: 'vaccination_expiration',
          severity: days <= 14 ? 'critical' : 'warning',
          title: `${record.name} vaccination expiring`,
          message:
            days < 0
              ? `${record.name} vaccination has expired`
              : `${record.name} vaccination expires in ${days} days`,
          dueAt: record.expiresAt,
          createdAt,
        })
      }
    }

    if (alerts.length === 0 && profile.passportExpiry) {
      alerts.push({
        alertId: `al_${Math.random().toString(36).slice(2, 9)}`,
        kind: 'document_reminder',
        severity: 'info',
        title: 'Documents look current',
        message: 'No urgent passport/visa/vaccination expirations detected',
        dueAt: null,
        createdAt,
      })
    }

    return alerts
  }
}

export function createDocumentAlerts(): DocumentAlerts {
  return new DocumentAlerts()
}

function pushExpiry(
  alerts: DocumentAlert[],
  input: {
    kind: DocumentAlert['kind']
    label: string
    expiry?: string | null
    createdAt: string
    now: Date
  },
): void {
  if (!input.expiry) return
  const days = daysUntil(input.expiry, input.now)
  if (days == null) return
  if (days > 180) return
  alerts.push({
    alertId: `al_${Math.random().toString(36).slice(2, 9)}`,
    kind: input.kind,
    severity: days < 0 ? 'critical' : days <= 30 ? 'critical' : days <= 90 ? 'warning' : 'info',
    title: `${input.label} expiration`,
    message:
      days < 0
        ? `${input.label} has expired`
        : `${input.label} expires in ${days} days`,
    dueAt: input.expiry,
    createdAt: input.createdAt,
  })
}

function daysUntil(iso: string, now: Date): number | null {
  const end = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(end.getTime())) return null
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((end.getTime() - start) / 86400000)
}
