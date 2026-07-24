/**
 * Phase 2 Stage 1 — Pipeline run state.
 * Tracks progress; never mutates completed stage records in place.
 */

import {
  DEFAULT_MIN_CONFIDENCE,
  type ConsultantPipelineInput,
  type ConsultantStageId,
  type StageIOContext,
  type StageResult,
} from './pipelineTypes'
import { createInitialContext } from './consultantContext'
import { EXECUTION_STAGE_ORDER } from './consultantStages'

export type PipelineRunStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'stopped_clarification'
  | 'disabled'

export interface ConsultantPipelineState {
  status: PipelineRunStatus
  input: ConsultantPipelineInput
  context: StageIOContext
  stages: StageResult[]
  currentStage: ConsultantStageId | null
  minConfidence: number
  stoppedEarly: boolean
  stopReason: string | null
  startedAtMs: number
}

export function createPipelineState(
  input: ConsultantPipelineInput,
): ConsultantPipelineState {
  return {
    status: 'idle',
    input,
    context: createInitialContext(input),
    stages: [],
    currentStage: EXECUTION_STAGE_ORDER[0] ?? null,
    minConfidence: input.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
    stoppedEarly: false,
    stopReason: null,
    startedAtMs: Date.now(),
  }
}

/** Append a completed stage record (immutable append). */
export function appendStageResult(
  state: ConsultantPipelineState,
  result: StageResult,
  nextContext: StageIOContext,
): ConsultantPipelineState {
  return {
    ...state,
    context: nextContext,
    stages: [...state.stages, result],
    currentStage: result.stageId,
  }
}

export function markRunning(state: ConsultantPipelineState): ConsultantPipelineState {
  return { ...state, status: 'running' }
}

export function markStoppedForClarification(
  state: ConsultantPipelineState,
  reason: string,
): ConsultantPipelineState {
  return {
    ...state,
    status: 'stopped_clarification',
    stoppedEarly: true,
    stopReason: reason,
  }
}

export function markCompleted(state: ConsultantPipelineState): ConsultantPipelineState {
  return {
    ...state,
    status: 'completed',
    stoppedEarly: false,
    stopReason: null,
    currentStage: 'unified_response',
  }
}

export function shouldStopForConfidence(
  state: ConsultantPipelineState,
  stageConfidence: number,
): boolean {
  return stageConfidence < state.minConfidence
}

export const ConsultantState = {
  create: createPipelineState,
  append: appendStageResult,
  markRunning,
  markStopped: markStoppedForClarification,
  markCompleted,
  shouldStop: shouldStopForConfidence,
}
