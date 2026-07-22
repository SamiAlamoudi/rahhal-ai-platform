/**
 * Sprint 115 — PipelineExplainer
 */

import type { PipelineContext } from './PipelineContext'
import type { PipelineStageResult } from './PipelineStages'

export function explainPipeline(input: {
  ctx: PipelineContext
  stages: PipelineStageResult[]
  partial: boolean
  earlyExit: boolean
}): string {
  const parts: string[] = []
  parts.push(
    `Unified execution pipeline ran ${input.stages.length} stage(s) for conversation ${input.ctx.conversationId}.`,
  )

  const completed = input.stages.filter(
    (s) => s.status === 'completed' || s.status === 'recovered',
  )
  const skipped = input.stages.filter((s) => s.status === 'skipped')
  const failed = input.stages.filter(
    (s) => s.status === 'failed' || s.status === 'timed_out',
  )

  parts.push(
    `Completed: ${completed.map((s) => s.stageId).join(', ') || 'none'}.`,
  )
  if (skipped.length) {
    parts.push(`Skipped: ${skipped.map((s) => s.stageId).join(', ')}.`)
  }
  if (failed.length) {
    parts.push(`Failed: ${failed.map((s) => s.stageId).join(', ')}.`)
  }
  if (input.earlyExit) {
    parts.push('Early exit requested after conversation understanding.')
  }
  if (input.partial) {
    parts.push('Result is partial — recoverable stage failures allowed continuation.')
  }
  if (input.ctx.memoryPresent) {
    parts.push('Traveler memory was available and used for preference resolution.')
  } else {
    parts.push('No traveler memory profile was present for this run.')
  }
  parts.push(
    `Confidence propagated to ${Math.round(input.ctx.confidence * 100)}%.`,
  )
  return parts.join(' ')
}

export class PipelineExplainer {
  explain(input: Parameters<typeof explainPipeline>[0]): string {
    return explainPipeline(input)
  }
}

export function createPipelineExplainer(): PipelineExplainer {
  return new PipelineExplainer()
}
