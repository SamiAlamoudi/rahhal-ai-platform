/**
 * Sprint 39 — Visa requirements intelligence (sandbox; future gov integrations).
 */

import {
  normalizeCountryCode,
  type DestinationRuleRow,
} from './rules/sandboxDestinationRules'
import type { VisaAssessment, VisaCategory } from './types'

export class VisaIntelligence {
  assess(input: {
    rule: DestinationRuleRow
    nationality: string
    transitCountries?: string[]
    purpose?: string
  }): VisaAssessment {
    const nationality = normalizeCountryCode(input.nationality)
    const category: VisaCategory =
      input.rule.visaByNationality[nationality] ?? input.rule.defaultVisa

    const transitVisaRequired = (input.transitCountries ?? []).some((transit) => {
      const code = normalizeCountryCode(transit)
      const dest = transit.toLowerCase()
      if (/london|uk|united kingdom|gb/.test(dest) || code === 'GB') {
        return (input.rule.transitVisaNationalities ?? []).includes(nationality)
          || ['IN', 'PK', 'NG'].includes(nationality)
      }
      return false
    })

    const required = category !== 'visa_free'
    const notes: string[] = []
    if (category === 'visa_free') notes.push('Visa-free entry for this nationality')
    if (category === 'visa_on_arrival') notes.push('Visa on arrival available')
    if (category === 'evisa') notes.push('Apply for eVisa / electronic authorization before travel')
    if (category === 'visa_required') notes.push('Embassy/consulate visa required before travel')
    if (category === 'multi_entry' || input.rule.multiEntry) notes.push('Multi-entry options may be available')
    if (transitVisaRequired) notes.push('Transit visa may be required for one or more transit points')
    if (input.purpose === 'business' && category === 'visa_free') {
      notes.push('Confirm business activities are allowed under visa-free stay')
    }

    const approvalProbability =
      category === 'visa_free'
        ? 0.99
        : category === 'visa_on_arrival'
          ? 0.9
          : input.rule.approvalProbability

    const summary =
      category === 'visa_free'
        ? `You can enter ${input.rule.destination} visa-free`
        : category === 'visa_on_arrival'
          ? `Visa on arrival is available for ${input.rule.destination}`
          : category === 'evisa'
            ? `An eVisa / ETA is required for ${input.rule.destination}`
            : `A visa is required for ${input.rule.destination}`

    return {
      category,
      required,
      multiEntry: input.rule.multiEntry || category === 'multi_entry',
      validityDays: input.rule.validityDays,
      processingDaysMin: category === 'visa_free' ? null : input.rule.processingDaysMin,
      processingDaysMax: category === 'visa_free' ? null : input.rule.processingDaysMax,
      approvalProbability,
      transitVisaRequired,
      notes,
      summary,
    }
  }
}

export function createVisaIntelligence(): VisaIntelligence {
  return new VisaIntelligence()
}
