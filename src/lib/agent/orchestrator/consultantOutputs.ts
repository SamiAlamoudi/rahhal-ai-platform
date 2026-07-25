/**
 * Phase 2 Stage 1 — Unified consultant response builder.
 * Composes prior stage outputs; adds no new intelligence algorithms.
 */

import {
  clamp01,
  uniqueStrings,
  type ConsultantPipelineLocale,
  type ConsultantStageId,
  type StageIOContext,
  type StageResult,
  type UnifiedConsultantResponse,
} from './pipelineTypes'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function strList(...groups: Array<string[] | undefined | null>): string[] {
  return uniqueStrings(groups.flatMap((g) => g ?? [])).slice(0, 8)
}

export function buildUnifiedConsultantResponse(options: {
  locale: ConsultantPipelineLocale
  context: StageIOContext
  stages: StageResult[]
  stoppedEarly: boolean
  stoppedAtStage: ConsultantStageId | null
}): UnifiedConsultantResponse {
  const { locale, context, stages, stoppedEarly, stoppedAtStage } = options
  const outs = context.stageOutputs

  const traveler = asRecord(outs.traveler_intelligence)
  const travelerSnap = asRecord(traveler?.snapshot)
  const reasoning = asRecord(outs.reasoning)
  const profile = asRecord(asRecord(reasoning?.profile)?.profile)
  const destination = asRecord(outs.destination_intelligence)
  const destSnap = asRecord(destination?.snapshot)
  const recommendation = asRecord(outs.recommendation_intelligence)
  const pkg = asRecord(recommendation?.package)
  const strategy = asRecord(outs.travel_strategy)
  const primary = asRecord(strategy?.primary)
  const altStrategy = Array.isArray(strategy?.alternatives)
    ? asRecord((strategy!.alternatives as unknown[])[0])
    : null
  const conversation = asRecord(outs.conversation)

  const travelerUnderstanding = strList(
    travelerSnap?.summary ? [String(travelerSnap.summary)] : null,
    profile?.styleNotes as string[] | undefined,
    context.travelerSnapshot.summary ? [context.travelerSnapshot.summary] : null,
    context.travelerSnapshot.purpose
      ? [
          locale === 'ar'
            ? `الغرض: ${context.travelerSnapshot.purpose}`
            : `Purpose: ${context.travelerSnapshot.purpose}`,
        ]
      : null,
    conversation?.displayText ? [String(conversation.displayText).slice(0, 240)] : null,
  )

  const destinationUnderstanding = strList(
    destSnap?.summary ? [String(destSnap.summary)] : null,
    destSnap?.strengths as string[] | undefined,
    context.planningSnapshot.destinations?.map((d) =>
      locale === 'ar' ? `وجهة قيد الدراسة: ${d}` : `Destination under consideration: ${d}`,
    ),
  )

  const recommendedStrategy = strList(
    primary?.summary ? [String(primary.summary)] : null,
    primary?.why as string[] | undefined,
    pkg?.primaryRecommendation
      ? [
          String(
            (asRecord(pkg.primaryRecommendation)?.summary as string) ??
              (asRecord(pkg.primaryRecommendation)?.label as string) ??
              '',
          ),
        ]
      : null,
    pkg?.whyThisOption as string[] | undefined,
  )

  const alternative = strList(
    altStrategy?.summary ? [String(altStrategy.summary)] : null,
    altStrategy?.why as string[] | undefined,
    (pkg?.alternatives as Array<{ label?: string; whyNotPrimary?: string[] }> | undefined)?.flatMap(
      (a) => [a.label ?? '', ...(a.whyNotPrimary ?? [])],
    ),
    pkg?.whyNotAlternatives as string[] | undefined,
  )

  const tradeoffs = strList(
    primary?.tradeoffs as string[] | undefined,
    pkg?.tradeoffs as string[] | undefined,
    (asRecord(reasoning?.overall)?.tradeoffs as string[]) ?? [],
  )

  const risks = strList(
    primary?.risks as string[] | undefined,
    pkg?.risks as string[] | undefined,
    (asRecord(reasoning?.risk)?.reasoning as string[]) ?? [],
  )

  const budgetImpact = strList(
    pkg?.budgetImpact as string[] | undefined,
    primary?.levers
      ? [
          locale === 'ar'
            ? `إجراء الميزانية: ${String(asRecord(primary.levers)?.budgetAction ?? 'unknown')}`
            : `Budget lever: ${String(asRecord(primary.levers)?.budgetAction ?? 'unknown')}`,
        ]
      : null,
  )

  const timeImpact = strList(
    pkg?.timeImpact as string[] | undefined,
    primary?.levers
      ? [
          locale === 'ar'
            ? `التوقيت: ${String(asRecord(primary.levers)?.goNowOrLater ?? 'unknown')}`
            : `Timing: ${String(asRecord(primary.levers)?.goNowOrLater ?? 'unknown')}`,
        ]
      : null,
  )

  const questions = strList(
    context.questions,
    stages.flatMap((s) => s.questions),
    strategy?.suggestedClarification as string[] | undefined,
    pkg?.questionsToImproveConfidence as string[] | undefined,
  )

  const confidence = clamp01(context.confidence)

  if (travelerUnderstanding.length === 0) {
    travelerUnderstanding.push(
      locale === 'ar'
        ? 'ما زال فهم المسافر أولياً — نحتاج إشارات أوضح.'
        : 'Traveler understanding is still preliminary — clearer signals needed.',
    )
  }

  return {
    travelerUnderstanding,
    destinationUnderstanding:
      destinationUnderstanding.length > 0
        ? destinationUnderstanding
        : [
            locale === 'ar'
              ? 'لم تُحدد وجهة بعد.'
              : 'No destination resolved yet.',
          ],
    recommendedStrategy:
      recommendedStrategy.length > 0
        ? recommendedStrategy
        : [
            locale === 'ar'
              ? 'لا استراتيجية مكتملة بعد — بانتظار معلومات كافية.'
              : 'No complete strategy yet — awaiting sufficient information.',
          ],
    alternative,
    tradeoffs,
    risks,
    budgetImpact,
    timeImpact,
    confidence,
    questions,
    needsClarification: stoppedEarly || confidence < 0.35 || questions.length > 0,
    stoppedAtStage,
    locale,
  }
}

export const ConsultantOutputs = {
  buildUnified: buildUnifiedConsultantResponse,
}
