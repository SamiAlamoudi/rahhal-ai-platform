/**
 * Confidence scoring for booking recommendations.
 */

import type {
  BookingReadinessResult,
  CostCombination,
  RankedOffer,
  RecommendationConfidence,
} from './types'

export function buildRecommendationConfidence(input: {
  ranked: RankedOffer[]
  combinations: CostCombination[]
  readiness: BookingReadinessResult
  locale?: 'ar' | 'en'
}): RecommendationConfidence {
  const top = input.ranked[0]
  const second = input.ranked[1]
  const locale = input.locale ?? 'en'

  if (!top) {
    return {
      confidence: input.readiness.bookingReady ? 0.35 : 0.2,
      reasons: [
        locale === 'ar'
          ? 'لا تتوفر نتائج كافية بعد للمقارنة'
          : 'Not enough comparable results yet',
      ],
      missingInformation: input.readiness.missingFields,
      alternatives: [],
    }
  }

  const gap = second ? Math.max(0, top.rankScore - second.rankScore) : 0.2
  const comboBoost = input.combinations[0] ? input.combinations[0].valueScore * 0.1 : 0
  const readinessPenalty = input.readiness.bookingReady ? 0 : 0.18
  const confidence = clamp01(top.confidence * 0.45 + top.rankScore * 0.4 + gap * 0.2 + comboBoost - readinessPenalty)

  const reasons = buildReasons(top, second, input.combinations[0] ?? null, locale)
  const alternatives = input.ranked.slice(1, 4).map((offer) => ({
    id: offer.id,
    title: offer.title,
    why: alternativeWhy(top, offer, locale),
  }))

  return {
    confidence,
    reasons,
    missingInformation: input.readiness.missingFields,
    alternatives,
  }
}

function buildReasons(
  top: RankedOffer,
  second: RankedOffer | undefined,
  combo: CostCombination | null,
  locale: 'ar' | 'en',
): string[] {
  const reasons: string[] = []
  const factors = Object.entries(top.rankFactors).sort((a, b) => b[1] - a[1])
  const strongest = factors[0]?.[0]
  if (strongest === 'preference') {
    reasons.push(locale === 'ar'
      ? 'يتوافق مع تفضيلاتك المحفوظة'
      : 'Matches your saved traveler preferences')
  } else if (strongest === 'refund') {
    reasons.push(locale === 'ar'
      ? 'مرونة الإلغاء والاسترداد أعلى'
      : 'Stronger refund / change flexibility')
  } else if (strongest === 'duration' || strongest === 'layover') {
    reasons.push(locale === 'ar'
      ? 'وقت السفر أو التوقف أفضل'
      : 'Better travel time or layover quality')
  } else if (strongest === 'location') {
    reasons.push(locale === 'ar'
      ? 'الموقع أقرب لاحتياجاتك'
      : 'Better location fit for your plans')
  } else if (strongest === 'quality' || strongest === 'rating') {
    reasons.push(locale === 'ar'
      ? 'جودة وتقييم أعلى بشكل عام'
      : 'Stronger overall quality and rating')
  } else {
    reasons.push(locale === 'ar'
      ? 'توازن أفضل بين السعر والجودة'
      : 'Better balance of price and quality')
  }

  if (second && top.rankScore - second.rankScore < 0.05) {
    reasons.push(locale === 'ar'
      ? 'الفرق مع البديل القريب ضيق — راجع البدائل'
      : 'Close race with a near alternative — review options')
  }
  if (combo) {
    reasons.push(locale === 'ar'
      ? `أفضل تجميعة بقيمة ${combo.total.amount} ${combo.total.currency}`
      : `Best combination totals ${combo.total.amount} ${combo.total.currency}`)
  }
  return reasons.slice(0, 4)
}

function alternativeWhy(top: RankedOffer, other: RankedOffer, locale: 'ar' | 'en'): string {
  const topPrice = top.price.normalizedAmount ?? top.price.amount
  const otherPrice = other.price.normalizedAmount ?? other.price.amount
  if (otherPrice + 1 < topPrice) {
    return locale === 'ar'
      ? 'أقل سعرًا مع تنازل بسيط عن الجودة'
      : 'Lower price with a small quality trade-off'
  }
  if ((other.rating ?? 0) > (top.rating ?? 0)) {
    return locale === 'ar'
      ? 'تقييم أعلى قليلًا'
      : 'Slightly higher rating'
  }
  return locale === 'ar'
    ? 'بديل قريب من الترشيح الأول'
    : 'Close alternative to the top pick'
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}
