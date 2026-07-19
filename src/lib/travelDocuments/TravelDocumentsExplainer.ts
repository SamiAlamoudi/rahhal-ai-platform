/**
 * Sprint 39 — Natural-language explanations for document / visa requirements.
 */

import type { DestinationRulesResult, DocumentAlert } from './types'

export class TravelDocumentsExplainer {
  explain(rules: DestinationRulesResult, locale: 'en' | 'ar' = 'en'): string {
    if (locale === 'ar') {
      return [
        rules.visa.summary,
        rules.passport.valid ? 'جواز سفرك ساري.' : 'هناك مشكلة في جواز السفر.',
        rules.visa.transitVisaRequired
          ? 'قد تحتاج تأشيرة عبور.'
          : 'لا تحتاج تأشيرة عبور.',
        rules.vaccination.summary.includes('No mandatory')
          ? 'لا توجد تطعيمات إلزامية.'
          : rules.vaccination.summary,
      ].join('\n')
    }

    const lines: string[] = []
    lines.push(`${rules.visa.summary}.`)
    if (rules.passport.valid) {
      lines.push('Your passport is valid.')
    } else {
      lines.push(`Passport issue: ${rules.passport.blockingIssues[0] ?? rules.passport.summary}.`)
    }
    lines.push(
      rules.visa.transitVisaRequired
        ? 'A transit visa may be required.'
        : 'No transit visa is required.',
    )
    if (rules.vaccination.missing.length === 0 && rules.vaccination.required.length === 0) {
      lines.push('No mandatory vaccinations.')
    } else {
      lines.push(`${rules.vaccination.summary}.`)
    }
    if (rules.digitalArrivalCardRequired) {
      lines.push('A digital arrival card is required.')
    }
    if (rules.customsDeclarationRequired) {
      lines.push('Prepare a customs declaration on arrival.')
    }
    return lines.join('\n')
  }

  explainAlerts(alerts: DocumentAlert[], locale: 'en' | 'ar' = 'en'): string {
    if (!alerts.length) {
      return locale === 'ar' ? 'لا توجد تنبيهات للمستندات.' : 'No document alerts.'
    }
    if (locale === 'ar') {
      return alerts.map((a) => `• ${a.title}: ${a.message}`).join('\n')
    }
    return alerts.map((a) => `• ${a.title}: ${a.message}`).join('\n')
  }

  explainCanTravel(rules: DestinationRulesResult, locale: 'en' | 'ar' = 'en'): string {
    const base = this.explain(rules, locale)
    if (locale === 'ar') {
      return `${base}\n${rules.canTravel ? 'يمكنك السفر مع استكمال المتطلبات.' : 'أكمل المتطلبات قبل السفر.'}`
    }
    return `${base}\n${
      rules.canTravel
        ? 'You can proceed once any outstanding visas/authorizations are arranged.'
        : 'Resolve passport/vaccination blockers before booking.'
    }`
  }
}

export function createTravelDocumentsExplainer(): TravelDocumentsExplainer {
  return new TravelDocumentsExplainer()
}
