/**
 * Evolution Sprint 6 — RecommendationBuilder
 * Assembles RecommendationPackage from scored candidates — no invented facts.
 */

import { collectEvidence } from './recommendationEvidence'
import { scoreCandidate } from './recommendationScorer'
import { assessImpacts } from './impactAnalyzer'
import { generateAlternatives } from './alternativeGenerator'
import {
  challengeAssumptions,
  questionsForMissing,
} from './decisionJustifier'
import {
  clamp01,
  isoNow,
  newId,
  uniqueStrings,
  type RecommendationAction,
  type RecommendationCandidate,
  type RecommendationEngineInput,
  type RecommendationPackage,
  type ScoredDimensions,
} from './recommendationTypes'

function pickAction(
  primary: RecommendationCandidate | null,
  confidence: number,
  candidates: RecommendationCandidate[],
  composites: number[],
): RecommendationAction {
  if (!primary || candidates.length === 0) return 'defer'
  if (confidence < 0.45 || (primary.missingData?.length ?? 0) >= 4) {
    return 'collect_information'
  }
  const challenged = challengeAssumptions(candidates)
  if (challenged.length >= 2 && confidence < 0.7) return 'challenge_assumption'
  if (candidates.length >= 2) {
    const sorted = [...composites].sort((a, b) => b - a)
    if (sorted.length >= 2 && Math.abs((sorted[0] ?? 0) - (sorted[1] ?? 0)) < 6) {
      return 'compare'
    }
  }
  return 'recommend'
}

export function buildRecommendationPackage(
  input: RecommendationEngineInput,
): RecommendationPackage {
  const now = input.now
  const locale = input.locale ?? 'ar'
  const candidates = input.candidates ?? []

  const scored = candidates.map((c) => {
    const s = scoreCandidate(c, candidates, input.travelerHints)
    return { candidate: c, ...s }
  })
  scored.sort((a, b) => b.compositeScore - a.compositeScore)

  const primary = scored[0]?.candidate ?? null
  const primaryScore = scored[0]
  const scoresByCandidate: Record<string, ScoredDimensions> = {}
  for (const s of scored) {
    scoresByCandidate[s.candidate.id] = {
      valueScore: s.valueScore,
      riskScore: s.riskScore,
      benefitScore: s.benefitScore,
      tradeoffScore: s.tradeoffScore,
      opportunityCostScore: s.opportunityCostScore,
      compositeScore: s.compositeScore,
    }
  }

  const evidence = collectEvidence(candidates, now)
  const impacts = primary
    ? assessImpacts(primary)
    : {
        budgetImpact: ['Budget impact unknown — no primary candidate.'],
        comfortImpact: ['Comfort impact unknown — no primary candidate.'],
        timeImpact: ['Time impact unknown — no primary candidate.'],
        travelQualityImpact: ['Travel quality impact unknown — no primary candidate.'],
      }

  const missingInformation = uniqueStrings([
    ...(primary?.missingData ?? []),
    ...candidates.flatMap((c) => c.missingData ?? []),
  ]).slice(0, 10)

  const baseConfidence = primary
    ? clamp01(
      (primary.confidence ?? 0.5) * 0.6
        + (1 - Math.min(1, missingInformation.length / 6)) * 0.25
        + Math.min(1, evidence.length / 8) * 0.15,
    )
    : 0.2

  const action = pickAction(
    primary,
    baseConfidence,
    candidates,
    scored.map((s) => s.compositeScore),
  )

  const whyThisOption = uniqueStrings([
    ...(primaryScore?.benefitNotes ?? []),
    ...(primaryScore?.valueNotes ?? []),
    ...(primary?.whyExists ? [`Scenario rationale: ${primary.whyExists}`] : []),
  ]).slice(0, 6)

  const whyNotAlternatives = uniqueStrings(
    scored.slice(1, 4).flatMap((s) => [
      `"${s.candidate.label}" trails on composite (${s.compositeScore} vs ${primaryScore?.compositeScore ?? 0}).`,
      ...s.opportunityNotes.slice(0, 1),
      ...s.riskNotes.slice(0, 1),
    ]),
  ).slice(0, 6)

  if (!whyNotAlternatives.length) {
    whyNotAlternatives.push(
      locale === 'ar'
        ? 'لا توجد بدائل كافية للمقارنة حالياً.'
        : 'No peer alternatives available to contrast yet.',
    )
  }

  const assumptionsChallenged = challengeAssumptions(candidates)
  const questionsToImproveConfidence = questionsForMissing(missingInformation, locale)

  const alternatives = generateAlternatives(
    primary?.id ?? null,
    scored.map((s) => ({ candidate: s.candidate, composite: s.compositeScore })),
  )

  const primaryLabel =
    primary?.label
    ?? (locale === 'ar' ? 'لا توصية محددة بعد' : 'No specific recommendation yet')

  const summary =
    action === 'collect_information'
      ? (locale === 'ar'
        ? 'الثقة منخفضة — اجمع المعلومات الناقصة قبل الالتزام.'
        : 'Confidence is low — collect missing information before committing.')
      : action === 'compare'
        ? (locale === 'ar'
          ? 'الخيارات متقاربة — قارن قبل الاختيار.'
          : 'Options are close — compare before locking.')
        : (locale === 'ar'
          ? `التوصية الأساسية: ${primaryLabel}`
          : `Primary recommendation: ${primaryLabel}`)

  const scores: ScoredDimensions = primaryScore
    ? {
        valueScore: primaryScore.valueScore,
        riskScore: primaryScore.riskScore,
        benefitScore: primaryScore.benefitScore,
        tradeoffScore: primaryScore.tradeoffScore,
        opportunityCostScore: primaryScore.opportunityCostScore,
        compositeScore: primaryScore.compositeScore,
      }
    : {
        valueScore: 0,
        riskScore: 0,
        benefitScore: 0,
        tradeoffScore: 0,
        opportunityCostScore: 0,
        compositeScore: 0,
      }

  return {
    id: newId('recpkg', now),
    locale,
    action,
    timestamp: isoNow(now),
    primaryRecommendation: {
      candidateId: primary?.id ?? null,
      label: primaryLabel,
      summary,
    },
    whyThisOption: whyThisOption.length
      ? whyThisOption
      : [locale === 'ar' ? 'لا أدلة كافية بعد.' : 'Insufficient evidence so far.'],
    whyNotAlternatives,
    benefits: uniqueStrings(primaryScore?.benefitNotes ?? []).slice(0, 6),
    risks: uniqueStrings([
      ...(primaryScore?.riskNotes ?? []),
      ...(primary?.risks ?? []),
    ]).slice(0, 6),
    tradeoffs: uniqueStrings([
      ...(primaryScore?.tradeoffNotes ?? []),
      ...(primary?.tradeoffs ?? []),
    ]).slice(0, 6),
    opportunityCost: uniqueStrings(primaryScore?.opportunityNotes ?? []).slice(0, 5),
    budgetImpact: impacts.budgetImpact,
    comfortImpact: impacts.comfortImpact,
    timeImpact: impacts.timeImpact,
    travelQualityImpact: impacts.travelQualityImpact,
    confidence: baseConfidence,
    evidence,
    missingInformation,
    questionsToImproveConfidence,
    assumptionsChallenged,
    alternatives,
    scores,
    scoresByCandidate,
    reasoningRef: input.reasoningRef ?? primary?.reasoningRef ?? null,
    reflectionRef: input.reflectionRef ?? primary?.reflectionRef ?? null,
    travelerModelRef: input.travelerModelRef ?? primary?.travelerModelRef ?? null,
    revisionOf: input.previous?.id ?? null,
    revisionReason: input.revisionReason ?? null,
  }
}

export const RecommendationBuilder = { build: buildRecommendationPackage }
