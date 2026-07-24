/**
 * Evolution Sprint 6 — RecommendationNarrative + formats
 * Template composition only — no LLM.
 */

import { explainConfidence, justifyDecision } from './decisionJustifier'
import type {
  ConsultantExplanation,
  DetailedRecommendation,
  ExecutiveRecommendation,
  RecommendationFormats,
  RecommendationPackage,
  ShortRecommendation,
} from './recommendationTypes'

function isAr(locale: 'ar' | 'en'): boolean {
  return locale !== 'en'
}

export function buildExecutive(pkg: RecommendationPackage): ExecutiveRecommendation {
  const ar = isAr(pkg.locale)
  const headline =
    pkg.action === 'collect_information'
      ? (ar ? 'اجمع معلومات قبل التوصية' : 'Collect information before recommending')
      : pkg.action === 'compare'
        ? (ar ? 'قارن الخيارات المتقاربة' : 'Compare close options')
        : pkg.action === 'challenge_assumption'
          ? (ar ? 'راجع الافتراضات أولاً' : 'Challenge assumptions first')
          : (ar ? 'توصية تنفيذية' : 'Executive recommendation')

  return {
    locale: pkg.locale,
    headline,
    oneLiner: pkg.primaryRecommendation.summary,
    confidencePct: Math.round(pkg.confidence * 100),
    action: pkg.action,
    topRisk: pkg.risks[0] ?? null,
    nextStep: pkg.questionsToImproveConfidence[0] ?? pkg.whyThisOption[0] ?? null,
  }
}

export function buildShort(pkg: RecommendationPackage): ShortRecommendation {
  const ar = isAr(pkg.locale)
  return {
    locale: pkg.locale,
    title: pkg.primaryRecommendation.label,
    why: pkg.whyThisOption[0] ?? (ar ? 'أدلة محدودة' : 'Limited evidence'),
    whyNot: pkg.whyNotAlternatives[0] ?? (ar ? 'لا بديل واضح' : 'No clear contrast'),
    confidencePct: Math.round(pkg.confidence * 100),
    missing: pkg.missingInformation.slice(0, 3),
  }
}

export function buildDetailed(pkg: RecommendationPackage): DetailedRecommendation {
  const ar = isAr(pkg.locale)
  const t = (en: string, arText: string) => (ar ? arText : en)
  return {
    locale: pkg.locale,
    package: pkg,
    sections: [
      { title: t('Why this option', 'لماذا هذا الخيار'), bullets: pkg.whyThisOption },
      { title: t('Why not alternatives', 'لماذا ليست البدائل'), bullets: pkg.whyNotAlternatives },
      { title: t('Benefits', 'الفوائد'), bullets: pkg.benefits },
      { title: t('Risks', 'المخاطر'), bullets: pkg.risks },
      { title: t('Trade-offs', 'المقايضات'), bullets: pkg.tradeoffs },
      { title: t('Opportunity cost', 'تكلفة الفرصة'), bullets: pkg.opportunityCost },
      { title: t('Budget impact', 'أثر الميزانية'), bullets: pkg.budgetImpact },
      { title: t('Comfort impact', 'أثر الراحة'), bullets: pkg.comfortImpact },
      { title: t('Time impact', 'أثر الوقت'), bullets: pkg.timeImpact },
      { title: t('Travel quality impact', 'أثر جودة السفر'), bullets: pkg.travelQualityImpact },
      { title: t('Missing information', 'معلومات ناقصة'), bullets: pkg.missingInformation },
      {
        title: t('Questions to improve confidence', 'أسئلة لرفع الثقة'),
        bullets: pkg.questionsToImproveConfidence,
      },
    ],
  }
}

export function buildConsultantExplanation(pkg: RecommendationPackage): ConsultantExplanation {
  const ar = isAr(pkg.locale)
  const voice = ar
    ? [
        'أفكر كمستشار سفر: أوضح القيمة والمخاطر قبل أن أقترح التزاماً.',
        `الإجراء المقترح: ${pkg.action}.`,
        `مستوى الثقة ${(pkg.confidence * 100).toFixed(0)}٪.`,
      ]
    : [
        'I reason as a travel consultant: value and risk before commitment.',
        `Proposed action: ${pkg.action}.`,
        `Confidence ${(pkg.confidence * 100).toFixed(0)}%.`,
      ]

  return {
    locale: pkg.locale,
    voice,
    justification: justifyDecision({
      primary: pkg.primaryRecommendation.candidateId
        ? {
            id: pkg.primaryRecommendation.candidateId,
            label: pkg.primaryRecommendation.label,
          }
        : null,
      action: pkg.action,
      why: pkg.whyThisOption,
      confidence: pkg.confidence,
    }),
    confidenceExplanation: explainConfidence({
      confidence: pkg.confidence,
      missing: pkg.missingInformation,
      evidenceCount: pkg.evidence.length,
      candidateCount: Object.keys(pkg.scoresByCandidate).length,
    }),
    challenge: pkg.assumptionsChallenged.length
      ? pkg.assumptionsChallenged
      : [
          ar
            ? 'لا توجد افتراضات متضاربة واضحة في الأدلة الحالية.'
            : 'No clear conflicting assumptions in current evidence.',
        ],
  }
}

export function buildFormats(pkg: RecommendationPackage): RecommendationFormats {
  return {
    executive: buildExecutive(pkg),
    short: buildShort(pkg),
    detailed: buildDetailed(pkg),
    consultant: buildConsultantExplanation(pkg),
  }
}

export const RecommendationNarrative = {
  executive: buildExecutive,
  short: buildShort,
  detailed: buildDetailed,
  consultant: buildConsultantExplanation,
  formats: buildFormats,
}
