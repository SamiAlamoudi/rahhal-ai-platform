/**
 * Phase AH — adapt TripPlannerResult into existing ResultsExperience shapes.
 * Presentation mapping only; does not rescore or re-plan.
 */

import type { FinalDecisionScore, RecommendationLevel } from '../../../../utils/decisionScoreEngine'
import type { ReasoningResult } from '../../../../utils/reasoningEngine'
import type {
  NormalizedOptionType,
  NormalizedTravelOption,
  SearchOrchestrationResult,
} from '../../../../utils/searchOrchestrator'
import type { Recommendation } from '../../recommendations/models'
import type { TripPlannerResult, TripPlannerStage, TripPlannerValidationError } from '../models'

function levelFromScore(score: number): RecommendationLevel {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'recommended'
  if (score >= 55) return 'acceptable'
  return 'not-recommended'
}

function optionType(kind: Recommendation['kind']): NormalizedOptionType {
  if (kind === 'flight') return 'flight'
  if (kind === 'hotel') return 'hotel'
  if (kind === 'activity') return 'activity'
  return 'transportation'
}

function emptySection(key: string, titleKey: string) {
  return { key, titleKey, items: [] as Array<{ key: string; params: Record<string, string | number> }> }
}

function buildDecisionScore(rec: Recommendation): FinalDecisionScore {
  const c = rec.score.components
  const weightedAverage = rec.score.overall
  const categories = [
    { category: 'preferenceMatch' as const, score: c.travelerPreferences, weight: 0.25, weightedScore: c.travelerPreferences * 0.25, reason: 'preference' },
    { category: 'destinationMatch' as const, score: c.destinationPopularity, weight: 0.15, weightedScore: c.destinationPopularity * 0.15, reason: 'destination' },
    { category: 'price' as const, score: c.budgetFit, weight: 0.2, weightedScore: c.budgetFit * 0.2, reason: 'budget' },
    { category: 'purposeMatch' as const, score: c.travelStyle, weight: 0.15, weightedScore: c.travelStyle * 0.15, reason: 'style' },
    { category: 'travelTime' as const, score: c.tripDuration, weight: 0.15, weightedScore: c.tripDuration * 0.15, reason: 'duration' },
    { category: 'comfort' as const, score: c.seasonality, weight: 0.1, weightedScore: c.seasonality * 0.1, reason: 'season' },
  ]
  return {
    categories,
    weightedAverage,
    confidence: rec.confidence,
    reasons: rec.reasons.map((r) => r.message),
    recommendation: levelFromScore(weightedAverage),
  }
}

export function recommendationToNormalizedOption(rec: Recommendation): NormalizedTravelOption {
  const decisionScore = buildDecisionScore(rec)
  return {
    id: rec.id,
    type: optionType(rec.kind),
    title: rec.title,
    providerIds: ['trip-planner-api'],
    price: 0,
    currency: 'SAR',
    durationMinutes: null,
    stops: null,
    rating: null,
    location: null,
    baggageIncluded: null,
    familyFriendly: null,
    refundable: null,
    attributes: {
      candidateId: rec.candidateId,
      kind: rec.kind,
      rank: rec.rank,
      overallScore: rec.score.overall,
    },
    decisionScore,
    recommendationLevel: decisionScore.recommendation,
    reasons: rec.reasons.map((r) => r.message),
  }
}

export function recommendationToReasoningResult(rec: Recommendation): ReasoningResult {
  const score = buildDecisionScore(rec)
  const strengthItems = rec.matchedPreferences.map((p) => ({
    key: 'matched_preference',
    params: { preference: p },
  }))
  const weaknessItems = rec.unmatchedPreferences.map((p) => ({
    key: 'unmatched_preference',
    params: { preference: p },
  }))
  const reasonItems = rec.reasons.map((r) => ({
    key: r.code,
    params: { message: r.message, category: r.category },
  }))

  return {
    optionId: rec.id,
    optionTitle: rec.title,
    optionType: optionType(rec.kind),
    recommendation: score.recommendation,
    weightedAverage: score.weightedAverage,
    confidence: rec.confidence,
    recommendationSummary: reasonItems.slice(0, 3),
    strengths: { key: 'strengths', titleKey: 'strengths', items: strengthItems },
    weaknesses: { key: 'weaknesses', titleKey: 'weaknesses', items: weaknessItems },
    budgetAnalysis: emptySection('budget', 'budget'),
    familySuitability: emptySection('family', 'family'),
    travelTimeAnalysis: emptySection('travel_time', 'travel_time'),
    comfortAnalysis: emptySection('comfort', 'comfort'),
    destinationMatch: emptySection('destination', 'destination'),
    purposeMatch: emptySection('purpose', 'purpose'),
    confidenceExplanation: {
      key: 'confidence',
      titleKey: 'confidence',
      items: [
        {
          key: 'confidence_value',
          params: { confidence: Number((rec.confidence * 100).toFixed(1)) },
        },
      ],
    },
    riskWarnings: emptySection('risks', 'risks'),
    decisionExplanation: reasonItems,
  }
}

export function adaptTripPlannerResultToSearchOrchestration(
  result: TripPlannerResult,
): SearchOrchestrationResult {
  const rankedOptions = result.recommendations.map(recommendationToNormalizedOption)
  return {
    requestId: result.requestId,
    startedAt: result.pipelineTimeline[0]?.at ?? result.generatedAt,
    completedAt: result.generatedAt,
    providersQueried: 1,
    providersSucceeded: result.status === 'failed' && !result.partial ? 0 : 1,
    providersFailed: result.status === 'failed' && !result.partial ? 1 : 0,
    rawResultsCount: rankedOptions.length,
    normalizedResultsCount: rankedOptions.length,
    duplicateResultsRemoved: 0,
    rankedOptions,
    errors: result.failure
      ? [
          {
            providerId: 'trip-planner-api',
            providerName: 'Trip Planner API',
            error: result.failure.message,
          },
        ]
      : [],
  }
}

export function adaptReasoningMap(
  result: TripPlannerResult,
): Map<string, ReasoningResult> {
  const map = new Map<string, ReasoningResult>()
  for (const rec of result.recommendations) {
    map.set(rec.id, recommendationToReasoningResult(rec))
  }
  return map
}

export const STAGE_LABELS_AR: Record<TripPlannerStage, string> = {
  Received: 'تم استلام الطلب',
  Validating: 'التحقق من البيانات',
  PreferencesPrepared: 'تجهيز التفضيلات',
  RecommendationsGenerated: 'توليد التوصيات',
  ItineraryGenerated: 'بناء خط السير',
  BookingPreviewGenerated: 'معاينة الحجز التجريبية',
  Completed: 'اكتمل التخطيط',
  Failed: 'فشل التخطيط',
  Cancelled: 'تم الإلغاء',
}

export const STAGE_LABELS_EN: Record<TripPlannerStage, string> = {
  Received: 'Request received',
  Validating: 'Validating',
  PreferencesPrepared: 'Preferences prepared',
  RecommendationsGenerated: 'Recommendations generated',
  ItineraryGenerated: 'Itinerary generated',
  BookingPreviewGenerated: 'Booking preview ready',
  Completed: 'Completed',
  Failed: 'Failed',
  Cancelled: 'Cancelled',
}

export function localizeValidationErrors(
  errors: TripPlannerValidationError[],
  locale: 'ar' | 'en',
): string[] {
  return errors.map((e) => {
    if (locale === 'en') return e.message
    switch (e.code) {
      case 'missing_destination':
        return 'يلزم اختيار وجهة واحدة واحدة على الأقل.'
      case 'invalid_travel_dates':
        return 'تواريخ السفر غير صالحة. تحقّق من تاريخ الذهاب والعودة.'
      case 'invalid_budget':
        return 'الميزانية يجب أن تكون رقماً موجباً.'
      case 'invalid_traveler_count':
        return 'عدد المسافرين غير صالح.'
      case 'unsupported_currency':
        return 'العملة غير مدعومة.'
      case 'conflicting_constraints':
        return 'هناك تفضيلات متعارضة. عدّل القيود ثم أعد المحاولة.'
      case 'expired_request_context':
        return 'انتهت صلاحية طلب التخطيط. أعد تأكيد ملف القرار.'
      case 'invalid_duration':
        return 'مدة الرحلة غير صالحة.'
      case 'missing_user_id':
        return 'يلزم تسجيل الدخول للمتابعة.'
      default:
        return e.message
    }
  })
}

export function formatApiTransportError(
  code: string | undefined,
  fallback: string,
  locale: 'ar' | 'en',
): string {
  if (locale === 'en') {
    switch (code) {
      case 'auth_error':
        return 'Your session expired. Please sign in again.'
      case 'forbidden_user_mismatch':
        return 'You are not allowed to plan for another user.'
      case 'rate_limited':
        return 'Too many requests. Please retry shortly.'
      case 'not_found':
        return 'Planning result not found.'
      default:
        return fallback
    }
  }
  switch (code) {
    case 'auth_error':
      return 'انتهت جلستك. سجّل الدخول مرة أخرى.'
    case 'forbidden_user_mismatch':
      return 'لا يمكنك إنشاء خطة لمستخدم آخر.'
    case 'rate_limited':
      return 'طلبات كثيرة. حاول مرة أخرى بعد لحظات.'
    case 'not_found':
      return 'لم يتم العثور على نتيجة التخطيط.'
    default:
      return fallback
  }
}

export function latestPipelineStage(result: TripPlannerResult | null): TripPlannerStage | null {
  if (!result?.pipelineTimeline.length) return null
  return result.pipelineTimeline[result.pipelineTimeline.length - 1]!.stage
}
