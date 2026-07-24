/**
 * Phase 2 Stage 1 — Consultant Pipeline
 *
 * Orchestrates existing AI modules in sequence. Enrich-only context.
 * Feature flag `ai.consultant_pipeline` default OFF.
 * Not wired into planTurn. CPU-only · no network · no LLM.
 */

import { isConsultantPipelineEnabled } from './consultantStages'
import { EXECUTION_STAGE_ORDER } from './consultantStages'
import { enrichContextFromStage } from './consultantContext'
import {
  appendStageResult,
  createPipelineState,
  markCompleted,
  markRunning,
  markStoppedForClarification,
  shouldStopForConfidence,
} from './consultantState'
import { executeConsultantStage } from './consultantExecution'
import { buildUnifiedConsultantResponse } from './consultantOutputs'
import {
  type ConsultantPipelineInput,
  type ConsultantPipelineResult,
  type ConsultantStageId,
  type StageResult,
} from './pipelineTypes'
import { CONSULTANT_PIPELINE_FEATURE_ID } from './integrationRegistry'

export { CONSULTANT_PIPELINE_FEATURE_ID, isConsultantPipelineEnabled }

/**
 * Full consultant pipeline pass.
 * Safe to call anytime; production wiring is gated by the feature flag
 * and is intentionally not attached to planTurn.
 */
export async function runConsultantPipeline(
  input: ConsultantPipelineInput,
): Promise<ConsultantPipelineResult> {
  const t0 = Date.now()
  let state = markRunning(createPipelineState(input))

  for (const stageId of EXECUTION_STAGE_ORDER) {
    const result = await executeConsultantStage(stageId, state.context, input)
    const nextCtx = enrichContextFromStage(state.context, result)
    state = appendStageResult(state, result, nextCtx)

    const stopForClarification =
      result.status === 'clarification' ||
      shouldStopForConfidence(state, result.confidence)

    if (stopForClarification) {
      const reason =
        result.status === 'clarification'
          ? `Stage ${stageId} requested clarification`
          : `Confidence ${result.confidence.toFixed(2)} below minimum ${state.minConfidence}`
      state = markStoppedForClarification(state, reason)

      const response = buildUnifiedConsultantResponse({
        locale: state.context.locale,
        context: state.context,
        stages: state.stages,
        stoppedEarly: true,
        stoppedAtStage: stageId,
      })

      // Ensure stopped stage is marked
      const stages: StageResult[] = state.stages.map((s) =>
        s.stageId === stageId && s.status === 'completed'
          ? { ...s, status: 'stopped' }
          : s,
      )

      return {
        locale: state.context.locale,
        enabled: true,
        stages,
        context: state.context,
        response,
        stoppedEarly: true,
        stopReason: reason,
        totalDurationMs: Math.max(0, Date.now() - t0),
      }
    }
  }

  state = markCompleted(state)

  const unifiedStage: StageResult = {
    stageId: 'unified_response',
    status: 'completed',
    confidence: state.context.confidence,
    evidence: ['stage:unified_response'],
    missingInformation: state.context.missingInformation.slice(0, 8),
    questions: state.context.questions.slice(0, 5),
    output: null,
    durationMs: 0,
    notes: ['Composed from prior stage outputs only.'],
  }

  const response = buildUnifiedConsultantResponse({
    locale: state.context.locale,
    context: state.context,
    stages: state.stages,
    stoppedEarly: false,
    stoppedAtStage: null,
  })
  unifiedStage.output = response

  return {
    locale: state.context.locale,
    enabled: true,
    stages: [...state.stages, unifiedStage],
    context: state.context,
    response,
    stoppedEarly: false,
    stopReason: null,
    totalDurationMs: Math.max(0, Date.now() - t0),
  }
}

/**
 * Gate-aware entry: returns null when the feature flag is off (unless forced).
 * Zero stage work while disabled.
 */
export async function tryRunConsultantPipeline(
  input: ConsultantPipelineInput,
): Promise<ConsultantPipelineResult | null> {
  if (!isConsultantPipelineEnabled({ enabled: input.enabled })) return null
  return runConsultantPipeline(input)
}

export const ConsultantPipeline = {
  run: runConsultantPipeline,
  tryRun: tryRunConsultantPipeline,
  featureId: CONSULTANT_PIPELINE_FEATURE_ID,
  stageOrder: EXECUTION_STAGE_ORDER as readonly ConsultantStageId[],
}
