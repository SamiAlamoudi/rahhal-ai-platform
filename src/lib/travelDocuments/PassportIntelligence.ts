/**
 * Sprint 39 — Passport validation & booking warnings.
 */

import type { PassportAssessment } from './types'

export class PassportIntelligence {
  assess(input: {
    passportExpiry?: string | null
    blankPages?: number | null
    machineReadable?: boolean | null
    validityRuleMonths: number
    minBlankPages: number
    departureDate?: string | null
  }): PassportAssessment {
    const warnings: string[] = []
    const blockingIssues: string[] = []
    const expiresInDays = daysUntil(input.passportExpiry)

    if (expiresInDays == null) {
      warnings.push('Passport expiry date is unknown — confirm before booking')
    } else if (expiresInDays < 0) {
      blockingIssues.push('Passport has already expired')
    } else {
      const requiredDays = Math.max(0, input.validityRuleMonths) * 30
      if (expiresInDays < requiredDays) {
        blockingIssues.push(
          `Passport must be valid for at least ${input.validityRuleMonths} month(s) beyond travel`,
        )
      } else if (expiresInDays < requiredDays + 60) {
        warnings.push('Passport is approaching the destination validity window')
      }
      if (expiresInDays <= 150) {
        warnings.push(`Passport expires in about ${expiresInDays} days`)
      }
    }

    const blankPages = input.blankPages
    const blankPagesOk =
      blankPages == null ? true : blankPages >= input.minBlankPages
    if (blankPages != null && !blankPagesOk) {
      blockingIssues.push(
        `Passport needs at least ${input.minBlankPages} blank page(s)`,
      )
    } else if (blankPages != null && blankPages <= input.minBlankPages) {
      warnings.push('Limited blank pages remaining')
    }

    const machineReadableOk = input.machineReadable !== false
    if (input.machineReadable === false) {
      blockingIssues.push('Passport is not machine-readable (MRP required)')
    } else if (input.machineReadable == null) {
      warnings.push('Machine-readable passport status not confirmed')
    }

    const valid = blockingIssues.length === 0
    const summary = valid
      ? expiresInDays != null
        ? `Passport is valid (${expiresInDays} days remaining)`
        : 'Passport appears acceptable with incomplete metadata'
      : `Passport issues: ${blockingIssues.join('; ')}`

    return {
      valid,
      expiresInDays,
      blankPagesOk,
      machineReadableOk,
      validityRuleMonths: input.validityRuleMonths,
      warnings,
      blockingIssues,
      summary,
    }
  }
}

export function createPassportIntelligence(): PassportIntelligence {
  return new PassportIntelligence()
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const end = new Date(`${iso.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(end.getTime())) return null
  const now = new Date()
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((end.getTime() - start) / 86400000)
}
