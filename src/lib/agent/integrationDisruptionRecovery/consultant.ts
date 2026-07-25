/**
 * Integration Sprint 10 — natural recovery explanations.
 */

import type { DisruptionRecoveryResult } from './types'

export function buildDisruptionRecoverySummary(
  result: Pick<
    DisruptionRecoveryResult,
    'disruption' | 'impact' | 'risk' | 'primary' | 'plans' | 'replan'
  >,
): { en: string; ar: string } {
  if (!result.disruption || !result.primary) {
    return {
      en: 'Tell me what went wrong (delay, missed connection, hotel cancel) and I’ll build recovery options.',
      ar: 'أخبرني بما حدث (تأخير، فوت ترانزيت، إلغاء فندق) وسأبني خيارات الاستعادة.',
    }
  }

  const d = result.disruption
  const p = result.primary
  const alt = result.plans.find((x) => x.id !== p.id)
  const replanNote = result.replan?.notesEn[0]

  const en = [
    `${d.summaryEn} · risk ${result.risk ?? d.risk}.`,
    result.impact?.summaryEn,
    `Recommended: ${p.titleEn} (score ${p.score}/100) · ~${p.extraCost} ${p.currency} · saves ~${p.timeSavedMinutes} min.`,
    p.whyEn,
    alt ? `Alternative: ${alt.titleEn}.` : null,
    replanNote ?? null,
  ].filter(Boolean).join(' ')

  const ar = [
    `${d.summaryAr} · المخاطر ${result.risk ?? d.risk}.`,
    result.impact?.summaryAr,
    `التوصية: ${p.titleAr} (درجة ${p.score}/100) · نحو ${p.extraCost} ${p.currency} · توفير نحو ${p.timeSavedMinutes} دقيقة.`,
    p.whyAr,
    alt ? `بديل: ${alt.titleAr}.` : null,
    result.replan?.notesAr[0] ?? null,
  ].filter(Boolean).join(' ')

  return { en, ar }
}
