/**
 * Sprint 118 — EditMetadata
 */

import type { AnalyzedEdit } from './EditAnalyzer'
import type { EditPlan } from './EditPlanner'
import type { EditDiff } from './EditDiff'

export interface EditMetadata {
  conversationId: string | null
  userId: string | null
  editKind: AnalyzedEdit['kind']
  stagesRerunCount: number
  stagesSkippedCount: number
  estimatedExecutionTimeMs: number
  actualExecutionTimeMs: number
  confidence: number
  confidenceDelta: number
  budgetDelta: number | null
  partial: boolean
  signals: string[]
}

export function buildEditMetadata(input: {
  conversationId?: string | null
  userId?: string | null
  plan: EditPlan
  diff: EditDiff
  actualExecutionTimeMs: number
  confidence: number
  partial: boolean
}): EditMetadata {
  return {
    conversationId: input.conversationId ?? null,
    userId: input.userId ?? null,
    editKind: input.plan.analyzed.kind,
    stagesRerunCount: input.plan.stagesToRerun.length,
    stagesSkippedCount: input.plan.stagesToSkip.length,
    estimatedExecutionTimeMs: input.plan.estimatedExecutionTimeMs,
    actualExecutionTimeMs: input.actualExecutionTimeMs,
    confidence: input.confidence,
    confidenceDelta: input.diff.confidenceDelta,
    budgetDelta: input.diff.budgetDelta,
    partial: input.partial,
    signals: input.plan.analyzed.signals.slice(),
  }
}

export class EditMetadataBuilder {
  build(input: Parameters<typeof buildEditMetadata>[0]): EditMetadata {
    return buildEditMetadata(input)
  }
}

export function createEditMetadataBuilder(): EditMetadataBuilder {
  return new EditMetadataBuilder()
}
