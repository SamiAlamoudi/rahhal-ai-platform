/**
 * Sprint 118 — ConversationEditor
 * Feature-flagged entry for incremental trip edits.
 */

import { isEditableConversationEnabled } from './feature'
import {
  SPRINT118_EDITABLE_CONVERSATION_VERSION,
  type ConversationEditInput,
  type EditSnapshot,
} from './EditAnalyzer'
import type { EditDiff } from './EditDiff'
import {
  createEditHistory,
  type EditHistory,
  type EditHistoryEntry,
} from './EditHistory'
import type { EditMetadata } from './EditMetadata'
import type { EditPlan } from './EditPlanner'
import {
  createEditRunner,
  type EditRunnerOptions,
  type EditRunnerResult,
} from './EditRunner'
import type { PipelineResult } from '../pipeline'

export interface ConversationEditorResult {
  version: string
  enabled: boolean
  ok: boolean
  empty: boolean
  plan: EditPlan | null
  diff: EditDiff | null
  metadata: EditMetadata | null
  pipeline: PipelineResult | null
  history: EditHistoryEntry[]
  latestHistoryEntry: EditHistoryEntry | null
  whatChanged: string[]
  affectedStages: string[]
  stagesToSkip: string[]
  stagesToRerun: string[]
  estimatedExecutionTimeMs: number
  logs: string[]
  latencyMs: number
}

export interface ConversationEditorOptions extends EditRunnerOptions {
  enabled?: boolean
  /** Shared history across edits (multiple edits). */
  history?: EditHistory
}

function disabledResult(latencyMs: number): ConversationEditorResult {
  return {
    version: SPRINT118_EDITABLE_CONVERSATION_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    plan: null,
    diff: null,
    metadata: null,
    pipeline: null,
    history: [],
    latestHistoryEntry: null,
    whatChanged: [],
    affectedStages: [],
    stagesToSkip: [],
    stagesToRerun: [],
    estimatedExecutionTimeMs: 0,
    logs: ['editable_conversation_disabled'],
    latencyMs,
  }
}

export class ConversationEditor {
  private readonly options: ConversationEditorOptions
  readonly history: EditHistory

  constructor(options: ConversationEditorOptions = {}) {
    this.options = options
    this.history = options.history ?? createEditHistory()
  }

  async edit(input: ConversationEditInput): Promise<ConversationEditorResult> {
    const started = Date.now()
    if (
      !isEditableConversationEnabled({ enabled: this.options.enabled })
    ) {
      return disabledResult(Date.now() - started)
    }

    const runner = createEditRunner({
      ...this.options,
      history: this.history,
    })
    const result = await runner.run(input)
    return this.toResult(result, Date.now() - started)
  }

  /** Apply multiple sequential edits against an evolving snapshot. */
  async editMany(
    edits: string[],
    seed: Omit<ConversationEditInput, 'editText'>,
  ): Promise<ConversationEditorResult[]> {
    const results: ConversationEditorResult[] = []
    let snapshot: EditSnapshot = { ...seed.snapshot }
    for (const editText of edits) {
      const result = await this.edit({
        ...seed,
        editText,
        snapshot,
      })
      results.push(result)
      if (result.enabled && result.pipeline && result.plan) {
        snapshot = {
          trip: result.plan.afterTrip,
          flights: result.pipeline.flightOffers.slice(),
          hotels: result.pipeline.hotelOffers.slice(),
          confidence: result.pipeline.confidence,
          budget: result.plan.afterTrip.budget ?? snapshot.budget,
          pipelineResult: result.pipeline,
          cities: result.diff?.after.cities ?? snapshot.cities,
        }
      }
    }
    return results
  }

  private toResult(
    result: EditRunnerResult,
    latencyMs: number,
  ): ConversationEditorResult {
    return {
      version: SPRINT118_EDITABLE_CONVERSATION_VERSION,
      enabled: true,
      ok: result.ok,
      empty: result.empty,
      plan: result.plan,
      diff: result.diff,
      metadata: result.metadata,
      pipeline: result.pipeline,
      history: this.history.list().slice(),
      latestHistoryEntry: result.historyEntry,
      whatChanged: result.plan.whatChanged,
      affectedStages: result.plan.affectedStages,
      stagesToSkip: result.plan.stagesToSkip,
      stagesToRerun: result.plan.stagesToRerun,
      estimatedExecutionTimeMs: result.plan.estimatedExecutionTimeMs,
      logs: ['editable_conversation_enabled', ...result.logs],
      latencyMs,
    }
  }
}

export function createConversationEditor(
  options?: ConversationEditorOptions,
): ConversationEditor {
  return new ConversationEditor(options)
}

export async function runConversationEditor(
  input: ConversationEditInput,
  options?: ConversationEditorOptions,
): Promise<ConversationEditorResult> {
  return createConversationEditor(options).edit(input)
}
