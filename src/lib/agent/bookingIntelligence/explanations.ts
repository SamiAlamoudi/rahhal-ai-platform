/**
 * User-facing recommendation explanations.
 * Never expose internal rank factors or score dumps.
 */

import type {
  CostCombination,
  RankedOffer,
  RecommendationExplanation,
} from './types'

export function explainRecommendations(input: {
  ranked: RankedOffer[]
  combinations: CostCombination[]
  locale: 'ar' | 'en'
  limit?: number
}): RecommendationExplanation[] {
  const limit = input.limit ?? 3
  return input.ranked.slice(0, limit).map((offer, index) => ({
    offerId: offer.id,
    locale: input.locale,
    explanation: explainOne(offer, input.ranked[index + 1], input.combinations[0] ?? null, input.locale),
  }))
}

function explainOne(
  offer: RankedOffer,
  runnerUp: RankedOffer | undefined,
  bestCombo: CostCombination | null,
  locale: 'ar' | 'en',
): string {
  const savings = runnerUp
    ? Math.round((runnerUp.price.normalizedAmount ?? runnerUp.price.amount)
      - (offer.price.normalizedAmount ?? offer.price.amount))
    : 0
  const currency = offer.price.normalizedCurrency || offer.price.currency

  if (offer.domain === 'hotels') {
    const walking = offer.walkingDistanceMeters
    if (locale === 'ar') {
      if (savings > 50 && walking != null && walking <= 900) {
        return `فضّلت هذا الفندق لأنه يوفر حوالي ${savings} ${currency} مع بقائه على مسافة مشي مناسبة (${walking}م).`
      }
      if (walking != null && walking <= 600) {
        return `اخترت هذا الفندق لموقعه القريب (حوالي ${walking}م مشيًا) مع تقييم ${offer.rating?.toFixed(1) ?? 'جيد'}.`
      }
      return `هذا الفندق يوازن بين السعر والجودة${offer.stars ? ` (${offer.stars} نجوم)` : ''} بشكل أفضل لرحلتك.`
    }
    if (savings > 50 && walking != null && walking <= 900) {
      return `I preferred this hotel because it saves about ${savings} ${currency} while staying within a comfortable walking distance (${walking}m).`
    }
    if (walking != null && walking <= 600) {
      return `I chose this hotel for its close location (about ${walking}m walk) with a ${offer.rating?.toFixed(1) ?? 'solid'} rating.`
    }
    return `This hotel balances price and quality${offer.stars ? ` (${offer.stars}★)` : ''} better for your trip.`
  }

  if (offer.domain === 'flights') {
    if (locale === 'ar') {
      if (offer.layoverCount === 0) {
        return `فضّلت هذه الرحلة لأنها مباشرة${offer.airline ? ` على ${offer.airline}` : ''} مع مرونة جيدة.`
      }
      if (savings > 100) {
        return `اخترت هذا الخيار لأنه يوفر نحو ${savings} ${currency} مع توقف مقبول.`
      }
      return `هذه الرحلة تعطي أفضل توازن بين المدة والسعر والمرونة.`
    }
    if (offer.layoverCount === 0) {
      return `I preferred this flight because it is direct${offer.airline ? ` on ${offer.airline}` : ''} with solid flexibility.`
    }
    if (savings > 100) {
      return `I chose this option because it saves about ${savings} ${currency} with an acceptable layover.`
    }
    return `This flight offers the best balance of duration, price, and flexibility.`
  }

  if (bestCombo && (bestCombo.flightId === offer.id || bestCombo.hotelId === offer.id)) {
    return locale === 'ar'
      ? `هذا الخيار ضمن أفضل تجميعة بقيمة إجمالية ${bestCombo.total.amount} ${bestCombo.total.currency}.`
      : `This option sits in the best combination totaling ${bestCombo.total.amount} ${bestCombo.total.currency}.`
  }

  return locale === 'ar'
    ? `هذا الترشيح يتفوق على البدائل القريبة في التوازن العام.`
    : `This pick outperforms nearby alternatives on overall balance.`
}

/** Compact facts for Conversation Brain TravelFacts.recommendations — not final prose. */
export function explanationFacts(explanations: RecommendationExplanation[]): string[] {
  return explanations.map((row) => row.explanation)
}
