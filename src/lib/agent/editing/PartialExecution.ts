/**
 * Sprint 118 — PartialExecution
 * Builds a patched PipelineInput and reuses Execution Pipeline / Streaming
 * public APIs — no engine rewrites.
 */

import {
  runUnifiedExecutionPipeline,
  type PipelineInput,
  type PipelineResult,
  type PipelineRunnerOptions,
} from '../pipeline'
import { runStreamingConversation } from '../streaming'
import type { EditPlan } from './EditPlanner'
import type { EditSnapshot } from './EditAnalyzer'

export interface PartialExecutionOptions {
  /** Force pipeline enabled for the partial rerun (does not mutate flag defaults). */
  pipelineOptions?: PipelineRunnerOptions
  useStreaming?: boolean
}

export function buildPartialPipelineInput(input: {
  plan: EditPlan
  snapshot: EditSnapshot
  conversationId?: string | null
  userId?: string | null
  basePipelineInput?: PipelineInput | null
  editText: string
}): PipelineInput {
  const base = input.basePipelineInput ?? {}
  const flights = input.plan.analyzed.clearFlights
    ? []
    : (input.snapshot.flights.slice() || (base.flights ?? []).slice())
  const hotels = input.plan.analyzed.clearHotels
    ? []
    : (input.snapshot.hotels.slice() || (base.hotels ?? []).slice())

  return {
    ...base,
    conversationId: input.conversationId ?? base.conversationId ?? null,
    userId: input.userId ?? base.userId ?? null,
    messages: [
      ...(base.messages ?? []),
      { role: 'user', text: input.editText },
    ],
    trip: {
      ...base.trip,
      ...input.snapshot.trip,
      ...input.plan.afterTrip,
    },
    flights,
    hotels,
    stageOverrides: {
      ...base.stageOverrides,
      ...input.plan.stageOverrides,
    },
    decisionExplanation: `edit:${input.plan.analyzed.kind}:${input.plan.analyzed.summary}`,
  }
}

export async function runPartialExecution(input: {
  plan: EditPlan
  snapshot: EditSnapshot
  conversationId?: string | null
  userId?: string | null
  basePipelineInput?: PipelineInput | null
  editText: string
  options?: PartialExecutionOptions
}): Promise<{
  pipeline: PipelineResult
  usedStreaming: boolean
}> {
  const pipelineInput = buildPartialPipelineInput(input)
  const useStreaming = input.options?.useStreaming === true

  if (useStreaming) {
    const streamed = await runStreamingConversation(pipelineInput, {
      enabled: true,
      pipelineOptions: {
        ...input.options?.pipelineOptions,
        enabled: true,
      },
    })
    // Prefer underlying pipeline result when present
    if (streamed.pipeline) {
      return { pipeline: streamed.pipeline, usedStreaming: true }
    }
  }

  const pipeline = await runUnifiedExecutionPipeline(pipelineInput, {
    ...input.options?.pipelineOptions,
    enabled: true,
  })
  return { pipeline, usedStreaming: false }
}

export class PartialExecution {
  buildInput(
    input: Parameters<typeof buildPartialPipelineInput>[0],
  ): PipelineInput {
    return buildPartialPipelineInput(input)
  }

  run(
    input: Parameters<typeof runPartialExecution>[0],
  ): Promise<{ pipeline: PipelineResult; usedStreaming: boolean }> {
    return runPartialExecution(input)
  }
}

export function createPartialExecution(): PartialExecution {
  return new PartialExecution()
}
