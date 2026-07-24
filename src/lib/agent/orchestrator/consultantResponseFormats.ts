/**
 * Phase 2 Stage 3 — Formatters for Executive / Short / Detailed / Consultant.
 * Template composition only — no LLM, no engine calls.
 */

import type { ConsultantResponseBody } from './consultantResponseTypes'
import type {
  ConsultantDetailedFormat,
  ConsultantExecutiveFormat,
  ConsultantResponseFormats,
  ConsultantResponseLocale,
  ConsultantShortFormat,
  ConsultantVoiceFormat,
} from './consultantResponseTypes'

function t(locale: ConsultantResponseLocale, en: string, ar: string): string {
  return locale === 'ar' ? ar : en
}

export function formatExecutive(
  body: ConsultantResponseBody,
  locale: ConsultantResponseLocale,
  lowConfidence: boolean,
): ConsultantExecutiveFormat {
  const headline = lowConfidence
    ? t(locale, 'Clarification needed', 'يلزم التوضيح')
    : t(locale, 'Consultant recommendation', 'توصية المستشار')
  return {
    kind: 'executive',
    locale,
    headline,
    oneLiner:
      body.executiveSummary[0]
      ?? body.primaryRecommendation[0]
      ?? t(locale, 'Insufficient evidence', 'أدلة غير كافية'),
    confidencePct: Math.round(body.confidenceScore * 100),
    nextStep:
      body.clarificationQuestions[0]
      ?? body.recommendedStrategy[0]
      ?? null,
  }
}

export function formatShort(
  body: ConsultantResponseBody,
  locale: ConsultantResponseLocale,
): ConsultantShortFormat {
  return {
    kind: 'short',
    locale,
    title:
      body.primaryRecommendation[0]
      ?? body.recommendedStrategy[0]
      ?? t(locale, 'Travel options', 'خيارات السفر'),
    why:
      body.benefits[0]
      ?? body.evidenceSummary[0]
      ?? t(locale, 'Limited evidence', 'أدلة محدودة'),
    whyNot:
      body.alternativeRecommendation[0]
      ?? body.tradeoffs[0]
      ?? t(locale, 'No clear contrast yet', 'لا مقارنة واضحة بعد'),
    confidencePct: Math.round(body.confidenceScore * 100),
    missing: body.missingInformation.slice(0, 4),
  }
}

export function formatDetailed(
  body: ConsultantResponseBody,
  locale: ConsultantResponseLocale,
): ConsultantDetailedFormat {
  return {
    kind: 'detailed',
    locale,
    sections: [
      { title: t(locale, 'Executive summary', 'الملخص التنفيذي'), bullets: body.executiveSummary },
      { title: t(locale, 'Traveler understanding', 'فهم المسافر'), bullets: body.travelerUnderstanding },
      { title: t(locale, 'Destination understanding', 'فهم الوجهة'), bullets: body.destinationUnderstanding },
      { title: t(locale, 'Recommended strategy', 'الاستراتيجية الموصى بها'), bullets: body.recommendedStrategy },
      { title: t(locale, 'Primary recommendation', 'التوصية الأساسية'), bullets: body.primaryRecommendation },
      { title: t(locale, 'Alternative recommendation', 'التوصية البديلة'), bullets: body.alternativeRecommendation },
      { title: t(locale, 'Trade-offs', 'المقايضات'), bullets: body.tradeoffs },
      { title: t(locale, 'Benefits', 'الفوائد'), bullets: body.benefits },
      { title: t(locale, 'Risks', 'المخاطر'), bullets: body.risks },
      { title: t(locale, 'Opportunity cost', 'تكلفة الفرصة'), bullets: body.opportunityCost },
      { title: t(locale, 'Evidence summary', 'ملخص الأدلة'), bullets: body.evidenceSummary },
      { title: t(locale, 'Missing information', 'معلومات ناقصة'), bullets: body.missingInformation },
      { title: t(locale, 'Clarification questions', 'أسئلة توضيحية'), bullets: body.clarificationQuestions },
    ],
  }
}

export function formatConsultant(
  body: ConsultantResponseBody,
  locale: ConsultantResponseLocale,
  lowConfidence: boolean,
): ConsultantVoiceFormat {
  const voice =
    locale === 'ar'
      ? [
          'أجمع طبقات المستشار في رد واحد دون تغيير خطة الإنتاج.',
          lowConfidence
            ? 'الثقة منخفضة — أعرض الأدلة الناقصة والأسئلة بدل التخمين.'
            : `مستوى الثقة ${(body.confidenceScore * 100).toFixed(0)}٪.`,
          body.executiveSummary[0] ?? 'لا ملخص تنفيذي بعد.',
        ]
      : [
          'I aggregate consultant layers into one response without changing production planning.',
          lowConfidence
            ? 'Confidence is low — showing missing evidence and questions instead of guessing.'
            : `Confidence ${(body.confidenceScore * 100).toFixed(0)}%.`,
          body.executiveSummary[0] ?? 'No executive summary yet.',
        ]

  return {
    kind: 'consultant',
    locale,
    voice,
    justification: strOrFallback(
      body.primaryRecommendation,
      body.recommendedStrategy,
      body.benefits,
    ),
    assumptionsNoted: body.missingInformation.slice(0, 6),
  }
}

function strOrFallback(...groups: string[][]): string[] {
  for (const g of groups) {
    if (g.length) return g.slice(0, 6)
  }
  return []
}

export function buildConsultantResponseFormats(
  body: ConsultantResponseBody,
  locale: ConsultantResponseLocale,
  lowConfidence: boolean,
): ConsultantResponseFormats {
  return {
    executive: formatExecutive(body, locale, lowConfidence),
    short: formatShort(body, locale),
    detailed: formatDetailed(body, locale),
    consultant: formatConsultant(body, locale, lowConfidence),
  }
}

export const ConsultantResponseFormatsBuilder = {
  build: buildConsultantResponseFormats,
  executive: formatExecutive,
  short: formatShort,
  detailed: formatDetailed,
  consultant: formatConsultant,
}
