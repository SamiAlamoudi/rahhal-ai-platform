/**
 * Evolution Sprint 1 — ExplanationGenerator
 * Template composition only — no LLM / API.
 */

import { reasonAboutRecommendation } from './recommendationReasoner'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantLocale,
  type ConsultantReasoningInput,
  type ExplanationResult,
  type RecommendationReasonerResult,
} from './consultantTypes'

const COPY: Record<
  ConsultantLocale,
  {
    clarify: string
    recommend: string
    compare: string
    proceed: string
    defer: string
    nextClarify: string
    nextRecommend: string
    nextCompare: string
    nextProceed: string
    nextDefer: string
  }
> = {
  ar: {
    clarify: 'نحتاج توضيحاً قبل توصية واثقة',
    recommend: 'اتجاه استشاري أولي',
    compare: 'مقارنة اتجاهات مناسبة',
    proceed: 'جاهزون لخطوة التخطيط التالية',
    defer: 'محادثة خفيفة — بلا توصية سفر الآن',
    nextClarify: 'أجب عن أهم معلومة ناقصة لرفع الثقة.',
    nextRecommend: 'أكد الاتجاه أو اطلب بديلاً.',
    nextCompare: 'اختر بين الاتجاهين أو صِغ قيداً جديداً.',
    nextProceed: 'انتقل لتخطيط المسودة عندما تكون جاهزاً.',
    nextDefer: 'عندما تريد تخطيط رحلة، صف نيتك باختصار.',
  },
  en: {
    clarify: 'Clarification needed before a confident recommendation',
    recommend: 'Initial consultant direction',
    compare: 'Compare fitting directions',
    proceed: 'Ready for the next planning step',
    defer: 'Light conversation — no travel recommendation yet',
    nextClarify: 'Answer the most important missing detail to raise confidence.',
    nextRecommend: 'Confirm the direction or ask for an alternative.',
    nextCompare: 'Choose between directions or add a new constraint.',
    nextProceed: 'Move into planning draft when ready.',
    nextDefer: 'When you want trip planning, briefly describe your intent.',
  },
}

function localeOf(input: ConsultantReasoningInput): ConsultantLocale {
  return input.locale === 'en' ? 'en' : 'ar'
}

function headlineFor(
  action: RecommendationReasonerResult['recommendation']['primaryAction'],
  locale: ConsultantLocale,
): string {
  const c = COPY[locale]
  switch (action) {
    case 'clarify':
      return c.clarify
    case 'compare_options':
      return c.compare
    case 'proceed_planning':
      return c.proceed
    case 'defer':
      return c.defer
    default:
      return c.recommend
  }
}

function nextStepFor(
  action: RecommendationReasonerResult['recommendation']['primaryAction'],
  locale: ConsultantLocale,
): string {
  const c = COPY[locale]
  switch (action) {
    case 'clarify':
      return c.nextClarify
    case 'compare_options':
      return c.nextCompare
    case 'proceed_planning':
      return c.nextProceed
    case 'defer':
      return c.nextDefer
    default:
      return c.nextRecommend
  }
}

export function generateExplanation(
  input: ConsultantReasoningInput,
  recommendation?: RecommendationReasonerResult,
): ExplanationResult {
  const locale = localeOf(input)
  const rec = recommendation ?? reasonAboutRecommendation(input)
  const r = rec.recommendation

  const body =
    locale === 'ar'
      ? [
          `لماذا: ${r.why[0] ?? ''}`,
          `لماذا لا: ${r.whyNot[0] ?? ''}`,
          `البديل: ${r.alternative[0] ?? ''}`,
          `المقايضات: ${r.tradeoffs[0] ?? ''}`,
          `المخاطر: ${r.risk[0] ?? ''}`,
          `القيمة المتوقعة: ${r.expectedValue[0] ?? ''}`,
        ]
      : [
          `Why: ${r.why[0] ?? ''}`,
          `Why not: ${r.whyNot[0] ?? ''}`,
          `Alternative: ${r.alternative[0] ?? ''}`,
          `Tradeoffs: ${r.tradeoffs[0] ?? ''}`,
          `Risk: ${r.risk[0] ?? ''}`,
          `Expected value: ${r.expectedValue[0] ?? ''}`,
        ]

  return {
    ...emptySlice({
      confidence: clamp01(rec.confidence),
      reasoning: [
        'Explanation composed from recommendation slices without an LLM call.',
        `Locale=${locale}; action=${r.primaryAction}.`,
      ],
      tradeoffs: r.tradeoffs,
      assumptions: rec.assumptions,
      missingInformation: rec.missingInformation,
      recommendationScore: clampScore(rec.recommendationScore),
    }),
    explanation: {
      locale,
      headline: headlineFor(r.primaryAction, locale),
      body,
      nextStep: nextStepFor(r.primaryAction, locale),
    },
  }
}

/** Six consultant questions for a recommendation package. */
export function formatConsultantAnswers(
  recommendation: RecommendationReasonerResult,
): Record<'why' | 'whyNot' | 'alternative' | 'tradeoffs' | 'risk' | 'expectedValue', string[]> {
  const r = recommendation.recommendation
  return {
    why: r.why,
    whyNot: r.whyNot,
    alternative: r.alternative,
    tradeoffs: r.tradeoffs,
    risk: r.risk,
    expectedValue: r.expectedValue,
  }
}

export const ExplanationGenerator = {
  generate: generateExplanation,
  formatAnswers: formatConsultantAnswers,
}
