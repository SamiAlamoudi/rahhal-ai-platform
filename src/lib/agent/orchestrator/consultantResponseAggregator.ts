/**
 * Phase 2 Stage 3 — Aggregate pipeline stage outputs into ConsultantResponseBody.
 * Read-only. Never invents facts. Never calls intelligence engines.
 */

import type { ConsultantPipelineResult } from './pipelineTypes'
import {
  clamp01,
  uniqueStrings,
  DEFAULT_RESPONSE_MIN_CONFIDENCE,
  type ConsultantResponseBody,
  type ConsultantResponseLocale,
} from './consultantResponseTypes'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function strList(...groups: Array<string[] | undefined | null>): string[] {
  return uniqueStrings(groups.flatMap((g) => g ?? [])).slice(0, 10)
}

export interface AggregationResult {
  body: ConsultantResponseBody
  sources: string[]
  lowConfidence: boolean
  aggregationMs: number
}

/**
 * Aggregate existing pipeline stage bags into one consultant body.
 * Does not mutate `pipeline` or any stage output.
 */
export function aggregateConsultantResponse(
  pipeline: ConsultantPipelineResult,
  options?: { minConfidence?: number },
): AggregationResult {
  const t0 = Date.now()
  const locale: ConsultantResponseLocale = pipeline.locale === 'en' ? 'en' : 'ar'
  const outs = pipeline.context.stageOutputs
  const sources: string[] = []

  const traveler = asRecord(outs.traveler_intelligence)
  if (traveler) sources.push('traveler_intelligence')
  const travelerSnap = asRecord(traveler?.snapshot)

  const destination = asRecord(outs.destination_intelligence)
  if (destination) sources.push('destination_intelligence')
  const destSnap = asRecord(destination?.snapshot)

  const strategy = asRecord(outs.travel_strategy)
  if (strategy) sources.push('travel_strategy')
  const primaryStrategy = asRecord(strategy?.primary)
  const altStrategy = Array.isArray(strategy?.alternatives)
    ? asRecord((strategy!.alternatives as unknown[])[0])
    : null

  const recommendation = asRecord(outs.recommendation_intelligence)
  if (recommendation) sources.push('recommendation_intelligence')
  const pkg = asRecord(recommendation?.package)
  const primaryRec = asRecord(pkg?.primaryRecommendation)

  const reflection = asRecord(outs.reflection)
  if (reflection) sources.push('reflection')
  const reflectionSession = asRecord(reflection?.session)
  const latestRec = asRecord(reflection?.latestRecommendation)

  const planningGraph = asRecord(outs.planning_graph)
  if (planningGraph) sources.push('planning_graph')

  const reasoning = asRecord(outs.reasoning)
  if (reasoning) sources.push('reasoning')
  const profile = asRecord(asRecord(reasoning?.profile)?.profile)

  const travelerUnderstanding = strList(
    travelerSnap?.summary ? [String(travelerSnap.summary)] : null,
    pipeline.response.travelerUnderstanding,
    profile?.styleNotes as string[] | undefined,
    pipeline.context.travelerSnapshot.purpose
      ? [
          locale === 'ar'
            ? `الغرض: ${pipeline.context.travelerSnapshot.purpose}`
            : `Purpose: ${pipeline.context.travelerSnapshot.purpose}`,
        ]
      : null,
  )

  const destinationUnderstanding = strList(
    destSnap?.summary ? [String(destSnap.summary)] : null,
    destSnap?.strengths as string[] | undefined,
    pipeline.response.destinationUnderstanding,
    pipeline.context.planningSnapshot.destinations?.map((d) =>
      locale === 'ar' ? `وجهة قيد الدراسة: ${d}` : `Destination under consideration: ${d}`,
    ),
  )

  const recommendedStrategy = strList(
    primaryStrategy?.summary ? [String(primaryStrategy.summary)] : null,
    primaryStrategy?.why as string[] | undefined,
    pipeline.response.recommendedStrategy,
  )

  const primaryRecommendation = strList(
    primaryRec?.summary ? [String(primaryRec.summary)] : null,
    primaryRec?.label ? [String(primaryRec.label)] : null,
    pkg?.whyThisOption as string[] | undefined,
    latestRec?.summary ? [String(latestRec.summary)] : null,
  )

  const alternativeRecommendation = strList(
    altStrategy?.summary ? [String(altStrategy.summary)] : null,
    altStrategy?.why as string[] | undefined,
    pipeline.response.alternative,
    (pkg?.alternatives as Array<{ label?: string; whyNotPrimary?: string[] }> | undefined)?.flatMap(
      (a) => [a.label ?? '', ...(a.whyNotPrimary ?? [])],
    ),
    pkg?.whyNotAlternatives as string[] | undefined,
  )

  const tradeoffs = strList(
    primaryStrategy?.tradeoffs as string[] | undefined,
    pkg?.tradeoffs as string[] | undefined,
    pipeline.response.tradeoffs,
    (asRecord(reasoning?.overall)?.tradeoffs as string[]) ?? [],
  )

  const benefits = strList(
    pkg?.benefits as string[] | undefined,
    primaryStrategy?.expectedValue as string[] | undefined,
    destSnap?.strengths as string[] | undefined,
  )

  const risks = strList(
    primaryStrategy?.risks as string[] | undefined,
    pkg?.risks as string[] | undefined,
    pipeline.response.risks,
    destSnap?.weaknesses as string[] | undefined,
  )

  const opportunityCost = strList(
    pkg?.opportunityCost as string[] | undefined,
    primaryStrategy?.opportunityCost as string[] | undefined,
  )

  const evidenceSummary = strList(
    pipeline.context.evidence,
    (pkg?.evidence as Array<{ text?: string }> | undefined)?.map((e) => e.text ?? ''),
    travelerSnap?.summary ? [`traveler:${String(travelerSnap.summary).slice(0, 120)}`] : null,
    planningGraph?.rootId ? [`planning_graph:root:${String(planningGraph.rootId)}`] : null,
    reflectionSession?.id ? [`reflection:${String(reflectionSession.id)}`] : null,
  )

  const missingInformation = strList(
    pipeline.context.missingInformation,
    pkg?.missingInformation as string[] | undefined,
    pipeline.response.needsClarification
      ? pipeline.response.questions.map((q) => `clarify:${q.slice(0, 80)}`)
      : null,
  )

  const clarificationQuestions = strList(
    pipeline.response.questions,
    pkg?.questionsToImproveConfidence as string[] | undefined,
    strategy?.suggestedClarification as string[] | undefined,
  )

  const confidenceScore = clamp01(
    Math.min(
      pipeline.response.confidence,
      typeof pkg?.confidence === 'number' ? pkg.confidence : 1,
      typeof primaryStrategy?.confidence === 'number' ? Number(primaryStrategy.confidence) : 1,
      pipeline.context.confidence,
    ),
  )

  const minConfidence = options?.minConfidence ?? DEFAULT_RESPONSE_MIN_CONFIDENCE
  const lowConfidence = confidenceScore < minConfidence

  // Never invent — when low confidence, prefer missing/questions over filler strategy claims.
  const executiveSummary = lowConfidence
    ? strList(
        [
          locale === 'ar'
            ? 'الثقة غير كافية لتوصية نهائية — نحتاج توضيحاً.'
            : 'Confidence is too low for a firm recommendation — clarification needed.',
        ],
        missingInformation.slice(0, 3),
        clarificationQuestions.slice(0, 2),
      )
    : strList(
        primaryRecommendation.slice(0, 1),
        recommendedStrategy.slice(0, 1),
        travelerUnderstanding.slice(0, 1),
        destinationUnderstanding.slice(0, 1),
      )

  // Fallbacks that do not invent destinations/prices — only state absence.
  if (travelerUnderstanding.length === 0) {
    travelerUnderstanding.push(
      locale === 'ar'
        ? 'فهم المسافر ما زال أولياً.'
        : 'Traveler understanding is still preliminary.',
    )
  }
  if (destinationUnderstanding.length === 0) {
    destinationUnderstanding.push(
      locale === 'ar' ? 'لم تُستخلص وجهة بعد.' : 'No destination understanding available yet.',
    )
  }

  const body: ConsultantResponseBody = {
    executiveSummary,
    travelerUnderstanding,
    destinationUnderstanding,
    recommendedStrategy: lowConfidence
      ? strList(
          [
            locale === 'ar'
              ? 'الاستراتيجية معلّقة حتى اكتمال الأدلة.'
              : 'Strategy held until evidence is sufficient.',
          ],
          recommendedStrategy.slice(0, 2),
        )
      : recommendedStrategy.length
        ? recommendedStrategy
        : [
            locale === 'ar'
              ? 'لا استراتيجية مكتملة من الطبقات الحالية.'
              : 'No complete strategy from current layers.',
          ],
    primaryRecommendation: lowConfidence
      ? strList(
          [
            locale === 'ar'
              ? 'لا توصية أولية نهائية — الأدلة ناقصة.'
              : 'No firm primary recommendation — evidence incomplete.',
          ],
          primaryRecommendation.slice(0, 2),
        )
      : primaryRecommendation.length
        ? primaryRecommendation
        : [
            locale === 'ar'
              ? 'لا توصية أولية متاحة بعد.'
              : 'No primary recommendation available yet.',
          ],
    alternativeRecommendation,
    tradeoffs,
    benefits,
    risks,
    opportunityCost,
    confidenceScore,
    evidenceSummary,
    missingInformation,
    clarificationQuestions,
  }

  return {
    body,
    sources: uniqueStrings(sources),
    lowConfidence,
    aggregationMs: Math.max(0, Date.now() - t0),
  }
}

export const ConsultantResponseAggregator = {
  aggregate: aggregateConsultantResponse,
}
