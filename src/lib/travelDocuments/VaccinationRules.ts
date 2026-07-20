/**
 * Sprint 39 — Vaccination & health certificate rules.
 */

import type { DestinationRuleRow } from './rules/sandboxDestinationRules'
import type { VaccinationAssessment, VaccinationRecord } from './types'

export class VaccinationRules {
  assess(input: {
    rule: DestinationRuleRow
    records?: VaccinationRecord[]
  }): VaccinationAssessment {
    const records = input.records ?? []
    const required: Array<{ vaccine: string; reason: string }> = []
    const recommended: Array<{ vaccine: string; reason: string }> = []
    const missing: string[] = []

    if (input.rule.yellowFeverRequired) {
      required.push({
        vaccine: 'yellow_fever',
        reason: `Yellow fever certificate may be required for ${input.rule.destination}`,
      })
      if (!hasValid(records, 'yellow_fever')) missing.push('yellow_fever')
    }

    if (input.rule.covidRequired) {
      required.push({
        vaccine: 'covid',
        reason: 'COVID vaccination / certificate currently required',
      })
      if (!hasValid(records, 'covid')) missing.push('covid')
    }

    for (const vaccine of input.rule.countryVaccines) {
      if (vaccine === 'yellow_fever' && input.rule.yellowFeverRequired) continue
      recommended.push({
        vaccine,
        reason: `Recommended for travel to ${input.rule.destination}`,
      })
    }

    const summary =
      missing.length === 0 && required.length === 0
        ? 'No mandatory vaccinations'
        : missing.length === 0
          ? `Required vaccinations appear satisfied (${required.map((r) => r.vaccine).join(', ')})`
          : `Missing vaccinations: ${missing.join(', ')}`

    return {
      required,
      recommended,
      medicalDeclarationRequired: input.rule.medicalDeclaration,
      healthCertificateRequired: input.rule.healthCertificate,
      missing,
      summary,
    }
  }
}

export function createVaccinationRules(): VaccinationRules {
  return new VaccinationRules()
}

function hasValid(records: VaccinationRecord[], vaccine: VaccinationRecord['vaccine']): boolean {
  const now = Date.now()
  return records.some((r) => {
    if (r.vaccine !== vaccine) return false
    if (!r.expiresAt) return true
    return new Date(r.expiresAt).getTime() >= now
  })
}
