/**
 * Evolution Sprint 2 — ExplanationRevision
 * Revises consultant-facing explanations when recommendations change.
 * Template-only — no LLM.
 */

import type { ConsultantLocale, ExplanationResult } from '../reasoning/consultantTypes'
import type { RecommendationRecord } from './reflectionTypes'

export interface ExplanationRevisionResult {
  locale: ConsultantLocale
  headline: string
  body: string[]
  changeNote: string | null
  nextStep: string | null
}

function localeCopy(locale: ConsultantLocale) {
  return locale === 'ar'
    ? {
        changePrefix: 'تحديث التوصية:',
        why: 'لماذا',
        whyNot: 'لماذا لا',
        alt: 'البديل',
        tradeoffs: 'المقايضات',
        risk: 'المخاطر',
        value: 'القيمة المتوقعة',
        conf: 'الثقة',
      }
    : {
        changePrefix: 'Recommendation update:',
        why: 'Why',
        whyNot: 'Why not',
        alt: 'Alternative',
        tradeoffs: 'Tradeoffs',
        risk: 'Risk',
        value: 'Expected value',
        conf: 'Confidence',
      }
}

export function reviseExplanation(options: {
  locale: ConsultantLocale
  record: RecommendationRecord | null
  previous: RecommendationRecord | null
  baseExplanation: ExplanationResult | null
}): ExplanationRevisionResult {
  const copy = localeCopy(options.locale)
  const rec = options.record
  if (!rec) {
    return {
      locale: options.locale,
      headline: options.baseExplanation?.explanation.headline ?? '',
      body: options.baseExplanation?.explanation.body ?? [],
      changeNote: null,
      nextStep: options.baseExplanation?.explanation.nextStep ?? null,
    }
  }

  const body =
    options.locale === 'ar'
      ? [
          `${copy.why}: ${rec.why[0] ?? ''}`,
          `${copy.whyNot}: ${rec.whyNot[0] ?? ''}`,
          `${copy.alt}: ${rec.alternative[0] ?? ''}`,
          `${copy.tradeoffs}: ${rec.tradeoffs[0] ?? ''}`,
          `${copy.risk}: ${rec.risk[0] ?? ''}`,
          `${copy.value}: ${rec.expectedValue[0] ?? ''}`,
          `${copy.conf}: ${(rec.confidence * 100).toFixed(0)}٪`,
        ]
      : [
          `${copy.why}: ${rec.why[0] ?? ''}`,
          `${copy.whyNot}: ${rec.whyNot[0] ?? ''}`,
          `${copy.alt}: ${rec.alternative[0] ?? ''}`,
          `${copy.tradeoffs}: ${rec.tradeoffs[0] ?? ''}`,
          `${copy.risk}: ${rec.risk[0] ?? ''}`,
          `${copy.value}: ${rec.expectedValue[0] ?? ''}`,
          `${copy.conf}: ${(rec.confidence * 100).toFixed(0)}%`,
        ]

  let changeNote: string | null = null
  if (options.previous && options.previous.id !== rec.id) {
    changeNote = `${copy.changePrefix} ${rec.reasonForChange}`
  }

  const headline =
    options.baseExplanation?.explanation.headline
    ?? (options.locale === 'ar' ? 'توصية مستشار محدّثة' : 'Updated consultant recommendation')

  return {
    locale: options.locale,
    headline,
    body,
    changeNote,
    nextStep: options.baseExplanation?.explanation.nextStep ?? null,
  }
}

export const ExplanationRevision = {
  revise: reviseExplanation,
}
