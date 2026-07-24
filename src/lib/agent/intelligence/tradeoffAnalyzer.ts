/**
 * Phase 3 Stage 4 — Trade-off analysis between alternatives.
 */

import type {
  AlternativeComparison,
  IntelligenceDimension,
  TradeoffInsight,
  TravelAlternative,
} from './types'
import { clamp01 } from './types'

const FOCUS_DIMENSIONS: IntelligenceDimension[] = [
  'price',
  'convenience',
  'visa_difficulty',
  'family_friendliness',
  'business_suitability',
  'weather_suitability',
  'accessibility',
]

let tradeoffSeq = 0

export function analyzeTravelTradeoffs(input: {
  alternatives: TravelAlternative[]
  comparisons: AlternativeComparison[]
  locale?: 'ar' | 'en'
}): TradeoffInsight[] {
  if (input.alternatives.length < 2) return []

  const locale = input.locale === 'ar' ? 'ar' : 'en'
  const byId = new Map(input.comparisons.map((c) => [c.alternativeId, c]))
  const insights: TradeoffInsight[] = []

  const primary = input.alternatives[0]
  for (let i = 1; i < input.alternatives.length; i += 1) {
    const other = input.alternatives[i]
    const a = byId.get(primary.id)
    const b = byId.get(other.id)
    if (!a || !b) continue

    for (const dimension of FOCUS_DIMENSIONS) {
      const aScore = a.dimensions.find((d) => d.dimension === dimension)?.score ?? 0
      const bScore = b.dimensions.find((d) => d.dimension === dimension)?.score ?? 0
      const delta = Math.abs(aScore - bScore)
      if (delta < 0.08) continue

      const winnerId = aScore >= bScore ? primary.id : other.id
      const winnerLabel = winnerId === primary.id ? primary.destination : other.destination
      const loserLabel = winnerId === primary.id ? other.destination : primary.destination

      tradeoffSeq += 1
      insights.push({
        id: `tradeoff-${tradeoffSeq}`,
        between: [primary.id, other.id],
        dimension,
        summary: summarizeTradeoff({
          locale,
          dimension,
          winnerLabel,
          loserLabel,
          delta,
        }),
        winnerId,
        confidence: clamp01(0.45 + delta),
      })
    }
  }

  // Keep the strongest trade-offs only
  return insights
    .sort((x, y) => y.confidence - x.confidence)
    .slice(0, 8)
}

function summarizeTradeoff(input: {
  locale: 'ar' | 'en'
  dimension: IntelligenceDimension
  winnerLabel: string
  loserLabel: string
  delta: number
}): string {
  const { locale, dimension, winnerLabel, loserLabel } = input
  if (locale === 'ar') {
    switch (dimension) {
      case 'price':
        return `${winnerLabel} تبدو أخف على الميزانية مقارنة بـ ${loserLabel} (إشارة تكلفة نسبية فقط).`
      case 'convenience':
        return `${winnerLabel} تتفوق في سهولة التنقل مقارنة بـ ${loserLabel}.`
      case 'visa_difficulty':
        return `${winnerLabel} قد تكون أبسط من ناحية الدخول مقارنة بـ ${loserLabel} — تحقق دائماً حسب جنسيتك.`
      case 'family_friendliness':
        return `${winnerLabel} أنسب للعائلات من ${loserLabel} وفق الإشارات المتاحة.`
      case 'business_suitability':
        return `${winnerLabel} أنسب لرحلات العمل من ${loserLabel}.`
      case 'weather_suitability':
        return `${winnerLabel} تبدو أوفق موسمياً من ${loserLabel} (بدون توقعات طقس حية).`
      case 'accessibility':
        return `${winnerLabel} قد تكون أوفق للوصولية من ${loserLabel} — يلزم التحقق الميداني.`
      default:
        return `${winnerLabel} تتفوق على ${loserLabel} في ${dimension}.`
    }
  }

  switch (dimension) {
    case 'price':
      return `${winnerLabel} looks lighter on budget than ${loserLabel} (relative cost signal only).`
    case 'convenience':
      return `${winnerLabel} ranks higher on convenience than ${loserLabel}.`
    case 'visa_difficulty':
      return `${winnerLabel} may be simpler on entry than ${loserLabel} — always verify for your nationality.`
    case 'family_friendliness':
      return `${winnerLabel} appears more family-friendly than ${loserLabel} from available cues.`
    case 'business_suitability':
      return `${winnerLabel} appears stronger for business travel than ${loserLabel}.`
    case 'weather_suitability':
      return `${winnerLabel} looks seasonally preferable to ${loserLabel} (not a live weather forecast).`
    case 'accessibility':
      return `${winnerLabel} may be stronger on accessibility than ${loserLabel} — verify on the ground.`
    default:
      return `${winnerLabel} outperforms ${loserLabel} on ${dimension}.`
  }
}

export const TradeoffAnalyzer = {
  analyze: analyzeTravelTradeoffs,
}
