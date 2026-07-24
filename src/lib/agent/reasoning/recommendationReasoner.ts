/**
 * Evolution Sprint 1 — RecommendationReasoner
 *
 * Synthesizes prior slices into a consultant recommendation that answers:
 * Why? Why not? Alternative? Tradeoffs? Risk? Expected value?
 * Deterministic — no API / booking / inventory.
 */

import { analyzeTravelerIntent } from './travelerIntentAnalyzer'
import { buildTravelerProfile } from './travelerProfileBuilder'
import { analyzeConstraints } from './constraintAnalyzer'
import { reasonAboutDestination } from './destinationReasoner'
import { reasonAboutBudget } from './budgetReasoner'
import { reasonAboutRisk } from './riskReasoner'
import { reasonAboutValue } from './valueReasoner'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type RecommendationReasonerResult,
} from './consultantTypes'

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export function reasonAboutRecommendation(
  input: ConsultantReasoningInput,
): RecommendationReasonerResult {
  const intent = analyzeTravelerIntent(input)
  const profile = buildTravelerProfile(input)
  const constraints = analyzeConstraints(input)
  const destination = reasonAboutDestination(input)
  const budget = reasonAboutBudget(input)
  const risk = reasonAboutRisk(input)
  const value = reasonAboutValue(input)

  const missingInformation = unique([
    ...intent.missingInformation,
    ...profile.missingInformation,
    ...constraints.missingInformation,
    ...destination.missingInformation,
    ...budget.missingInformation,
    ...risk.missingInformation,
    ...value.missingInformation,
  ])

  const hardCount = constraints.constraints.hard.length
  const hasDirection =
    Boolean(destination.destinationFit.statedDestination)
    || destination.destinationFit.openEnded

  let primaryAction: RecommendationReasonerResult['recommendation']['primaryAction'] =
    'recommend_direction'

  if (intent.intent === 'small_talk') {
    primaryAction = 'defer'
  } else if (intent.intent === 'compare') {
    primaryAction = 'compare_options'
  } else if (
    intent.intent === 'plan'
    && destination.destinationFit.statedDestination
    && typeof input.known?.budgetAmount === 'number'
    && typeof input.known?.durationDays === 'number'
  ) {
    primaryAction = 'proceed_planning'
  } else if (intent.intent === 'unclear' || (missingInformation.length >= 4 && intent.intent !== 'discover')) {
    primaryAction = 'clarify'
  } else if (!hasDirection && intent.intent !== 'discover' && intent.intent !== 'budget') {
    primaryAction = 'clarify'
  }

  const destLabel =
    destination.destinationFit.statedDestination
    ?? (destination.destinationFit.openEnded
      ? destination.destinationFit.alternativesToConsider[0] ?? 'an open direction'
      : 'a still-open destination')

  const why = [
    `Recommend ${primaryAction.replace(/_/g, ' ')} because intent=${intent.intent} and purpose=${profile.profile.purpose}.`,
    destination.destinationFit.suitabilityNotes[0]
      ?? `Directional fit centers on ${destLabel}.`,
    value.value.expectedValueSummary,
  ]

  const whyNot: string[] = [
    ...destination.destinationFit.whyNotNotes,
  ]
  if (budget.budget.stance === 'strict' && profile.profile.purpose === 'honeymoon') {
    whyNot.push('Do not push luxury-tier directions under a strict budget without traveler consent.')
  }
  if (risk.risks.tolerance === 'low' && profile.profile.purpose === 'adventure') {
    whyNot.push('Do not recommend high-friction adventure paths while risk tolerance is low.')
  }
  if (whyNot.length === 0) {
    whyNot.push('No strong contra-signal against this consultant direction given current information.')
  }

  const alternative = [
    destination.destinationFit.alternativesToConsider[0]
      ? `Alternative direction: ${destination.destinationFit.alternativesToConsider.slice(0, 2).join(' or ')}.`
      : 'Alternative: keep destination open and gather one clearer preference before locking.',
    intent.intent === 'compare'
      ? 'Present two fit-ranked directions rather than a single lock.'
      : 'If the traveler rejects the primary path, fall back to clarification on purpose or budget stance.',
  ]

  const tradeoffs = unique([
    ...destination.tradeoffs,
    ...budget.tradeoffs,
    ...risk.tradeoffs,
    ...value.tradeoffs,
    'Consultant clarity can feel directive — keep alternatives visible.',
  ])

  const riskNotes = [
    ...risk.risks.identified.slice(0, 2),
    ...risk.risks.mitigations.slice(0, 2),
  ]

  const expectedValue = [
    value.value.expectedValueSummary,
    ...value.value.drivers.slice(0, 3).map((d) => `Value driver: ${d}`),
    ...value.value.cheapnessCost.slice(0, 2).map((c) => `Cheapness cost: ${c}`),
  ]

  const confidence = clamp01(
    (intent.confidence
      + profile.confidence
      + constraints.confidence
      + destination.confidence
      + budget.confidence
      + risk.confidence
      + value.confidence)
      / 7,
  )

  const recommendationScore = clampScore(
    destination.recommendationScore * 0.2
      + budget.recommendationScore * 0.2
      + value.recommendationScore * 0.25
      + risk.recommendationScore * 0.15
      + constraints.recommendationScore * 0.1
      + intent.recommendationScore * 0.1
      - hardCount * 2,
  )

  return {
    ...emptySlice({
      confidence,
      reasoning: [
        `Synthesized recommendation action=${primaryAction}.`,
        ...why.slice(0, 2),
        `Missing information count=${missingInformation.length}.`,
      ],
      tradeoffs,
      assumptions: unique([
        ...intent.assumptions,
        ...profile.assumptions,
        ...destination.assumptions,
        ...budget.assumptions,
        ...risk.assumptions,
        ...value.assumptions,
      ]),
      missingInformation,
      recommendationScore,
    }),
    recommendation: {
      primaryAction,
      why,
      whyNot,
      alternative,
      tradeoffs,
      risk: riskNotes,
      expectedValue,
    },
  }
}

export const RecommendationReasoner = { reason: reasonAboutRecommendation }
