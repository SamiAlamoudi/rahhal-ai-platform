/**
 * Phase 2 Stage 4 — Shared runtime context (enrich-only).
 */

import type { RuntimeKnownSlots, RuntimeLocale, RuntimeStageId } from './runtimeTypes'

export interface RuntimeSharedContext {
  locale: RuntimeLocale
  userText: string
  conversationId: string
  sessionId: string
  known: RuntimeKnownSlots
  tripPlan: unknown
  requirements: unknown
  toolResults: unknown[] | undefined
  /** Stage outputs — write-once per stage. */
  stageOutputs: Partial<Record<RuntimeStageId, unknown>>
  evidence: string[]
  missingInformation: string[]
  confidence: number
}

export function createRuntimeSharedContext(input: {
  locale: RuntimeLocale
  userText: string
  conversationId: string
  sessionId: string
  known?: RuntimeKnownSlots
  tripPlan?: unknown
  requirements?: unknown
  toolResults?: unknown[]
}): RuntimeSharedContext {
  return {
    locale: input.locale,
    userText: input.userText,
    conversationId: input.conversationId,
    sessionId: input.sessionId,
    known: input.known ? { ...input.known } : {},
    tripPlan: input.tripPlan,
    requirements: input.requirements,
    toolResults: input.toolResults,
    stageOutputs: {},
    evidence: [],
    missingInformation: [],
    confidence: 0.5,
  }
}

/** Attach stage output without overwriting an existing bag. */
export function attachStageOutput(
  ctx: RuntimeSharedContext,
  stageId: RuntimeStageId,
  output: unknown,
  extras?: { evidence?: string[]; missing?: string[]; confidence?: number },
): RuntimeSharedContext {
  const stageOutputs = { ...ctx.stageOutputs }
  if (stageOutputs[stageId] === undefined) {
    stageOutputs[stageId] = output
  }
  const evidence = unique([
    ...ctx.evidence,
    ...(extras?.evidence ?? []),
  ]).slice(0, 40)
  const missingInformation = unique([
    ...ctx.missingInformation,
    ...(extras?.missing ?? []),
  ]).slice(0, 24)
  const confidence =
    typeof extras?.confidence === 'number'
      ? Math.min(ctx.confidence, Math.max(0, Math.min(1, extras.confidence)))
      : ctx.confidence
  return {
    ...ctx,
    stageOutputs,
    evidence,
    missingInformation,
    confidence,
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))]
}

export const RuntimeContext = {
  create: createRuntimeSharedContext,
  attach: attachStageOutput,
}
