/**
 * Sprint 118 — EditRunner
 * Analyze → plan → partial execute → diff → history → metadata.
 */

import { analyzeEdit, type ConversationEditInput } from './EditAnalyzer'
import { buildEditDiff, type EditDiff } from './EditDiff'
import { createEditHistory, type EditHistory, type EditHistoryEntry } from './EditHistory'
import { buildEditMetadata, type EditMetadata } from './EditMetadata'
import { buildEditPlan, type EditPlan } from './EditPlanner'
import {
  runPartialExecution,
  type PartialExecutionOptions,
} from './PartialExecution'
import type { PipelineResult } from '../pipeline'

export interface EditRunnerResult {
  ok: boolean
  empty: boolean
  plan: EditPlan
  diff: EditDiff
  metadata: EditMetadata
  pipeline: PipelineResult | null
  historyEntry: EditHistoryEntry
  usedStreaming: boolean
  logs: string[]
  latencyMs: number
}

export interface EditRunnerOptions extends PartialExecutionOptions {
  history?: EditHistory
}

export class EditRunner {
  private readonly options: EditRunnerOptions
  readonly history: EditHistory

  constructor(options: EditRunnerOptions = {}) {
    this.options = options
    this.history = options.history ?? createEditHistory()
  }

  async run(input: ConversationEditInput): Promise<EditRunnerResult> {
    const started = Date.now()
    const logs: string[] = ['edit_runner_start']
    const analyzed = analyzeEdit(input.editText, input.snapshot)
    logs.push(`edit_kind_${analyzed.kind}`)
    const plan = buildEditPlan(analyzed, input.snapshot)
    logs.push(`stages_rerun_${plan.stagesToRerun.length}`)
    logs.push(`stages_skip_${plan.stagesToSkip.length}`)

    const { pipeline, usedStreaming } = await runPartialExecution({
      plan,
      snapshot: input.snapshot,
      conversationId: input.conversationId,
      userId: input.userId,
      basePipelineInput: input.basePipelineInput,
      editText: input.editText,
      options: {
        pipelineOptions: this.options.pipelineOptions,
        useStreaming: input.useStreaming ?? this.options.useStreaming,
      },
    })
    logs.push(usedStreaming ? 'used_streaming' : 'used_pipeline')

    const latencyMs = Date.now() - started
    const diff = buildEditDiff({
      plan,
      snapshot: input.snapshot,
      afterResult: pipeline,
      executionTimeMs: latencyMs,
    })
    const metadata = buildEditMetadata({
      conversationId: input.conversationId,
      userId: input.userId,
      plan,
      diff,
      actualExecutionTimeMs: latencyMs,
      confidence: pipeline.confidence,
      partial: pipeline.partial || plan.stagesToSkip.length > 0,
    })
    const historyEntry = this.history.recordPlan(
      input.editText,
      plan,
      diff,
      pipeline.ok,
    )
    logs.push('edit_runner_done')

    return {
      ok: pipeline.ok,
      empty: pipeline.empty,
      plan,
      diff,
      metadata,
      pipeline,
      historyEntry,
      usedStreaming,
      logs,
      latencyMs,
    }
  }
}

export function createEditRunner(options?: EditRunnerOptions): EditRunner {
  return new EditRunner(options)
}

export async function runConversationEdit(
  input: ConversationEditInput,
  options?: EditRunnerOptions,
): Promise<EditRunnerResult> {
  return createEditRunner(options).run(input)
}
