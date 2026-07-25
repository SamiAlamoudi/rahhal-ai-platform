/**
 * Phase 3 Stage 4 — Compare travel alternatives across dimensions.
 */

import type {
  AlternativeComparison,
  DimensionScore,
  IntelligenceContext,
  IntelligenceDimension,
  IntelligenceEvidence,
  TravelAlternative,
} from './types'
import { clamp01 } from './types'

function ev(
  kind: string,
  detail: string,
  source: IntelligenceEvidence['source'] = 'comparison',
): IntelligenceEvidence {
  return { kind, detail, source }
}

/** Higher is better for all normalized dimension scores. */
export function scoreAlternativeDimensions(
  alternative: TravelAlternative,
  context: IntelligenceContext,
): DimensionScore[] {
  const priceScore = clamp01(1 - alternative.priceSignal)
  const durationScore =
    alternative.durationDays == null
      ? 0.5
      : clamp01(1 - Math.min(1, alternative.durationDays / 21))

  const dims: Array<[IntelligenceDimension, number, IntelligenceEvidence[]]> = [
    [
      'price',
      priceScore,
      [ev('price_signal', String(alternative.priceSignal), 'alternative')],
    ],
    [
      'duration',
      durationScore,
      [
        ev(
          'duration_days',
          String(alternative.durationDays ?? 'unknown'),
          'alternative',
        ),
      ],
    ],
    [
      'convenience',
      alternative.convenience,
      [ev('convenience', String(alternative.convenience), 'alternative')],
    ],
    [
      'visa_difficulty',
      clamp01(1 - alternative.visaDifficulty),
      [ev('visa_difficulty', String(alternative.visaDifficulty), 'alternative')],
    ],
    [
      'weather_suitability',
      alternative.weatherSuitability,
      [ev('weather', String(alternative.weatherSuitability), 'alternative')],
    ],
    [
      'family_friendliness',
      alternative.familyFriendliness,
      [ev('family', String(alternative.familyFriendliness), 'alternative')],
    ],
    [
      'business_suitability',
      alternative.businessSuitability,
      [ev('business', String(alternative.businessSuitability), 'alternative')],
    ],
    [
      'accessibility',
      alternative.accessibility,
      [ev('accessibility', String(alternative.accessibility), 'alternative')],
    ],
    [
      'preference_fit',
      alternative.preferenceFit,
      [ev('preference_fit', String(alternative.preferenceFit), 'preferences')],
    ],
    [
      'conversation_fit',
      alternative.conversationFit,
      [ev('conversation_fit', String(alternative.conversationFit), 'conversation')],
    ],
  ]

  // Soft weight cues from context (still comparative, not planning).
  return dims.map(([dimension, score, evidence]) => {
    let adjusted = score
    if (dimension === 'family_friendliness' && context.hasFamilySignal) {
      adjusted = clamp01(adjusted + 0.03)
      evidence = [...evidence, ev('family_cue', 'present', 'user_text')]
    }
    if (dimension === 'business_suitability' && context.hasBusinessSignal) {
      adjusted = clamp01(adjusted + 0.03)
      evidence = [...evidence, ev('business_cue', 'present', 'user_text')]
    }
    if (dimension === 'accessibility' && context.hasAccessibilitySignal) {
      adjusted = clamp01(adjusted + 0.04)
      evidence = [...evidence, ev('accessibility_cue', 'present', 'user_text')]
    }
    if (dimension === 'price' && context.budgetAmount != null) {
      evidence = [
        ...evidence,
        ev('budget', String(context.budgetAmount), 'memory'),
      ]
    }
    return { dimension, score: clamp01(adjusted), evidence }
  })
}

export function compareTravelAlternatives(input: {
  alternatives: TravelAlternative[]
  context: IntelligenceContext
}): AlternativeComparison[] {
  return input.alternatives.map((alt) => {
    const dimensions = scoreAlternativeDimensions(alt, input.context)
    const overallScore = clamp01(
      dimensions.reduce((sum, d) => sum + d.score, 0) / Math.max(1, dimensions.length),
    )
    return {
      alternativeId: alt.id,
      dimensions,
      overallScore,
    }
  })
}

export const TravelComparator = {
  scoreDimensions: scoreAlternativeDimensions,
  compare: compareTravelAlternatives,
}
