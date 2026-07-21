/**
 * Agent-facing result snapshot for Sprint 79 Autonomous Decision Engine.
 */

import type { DecisionEngineResult } from '../../../core'

export type AutonomousDecisionResult = DecisionEngineResult

export interface AutonomousDecisionMeta {
  bestOverallId: string | null
  bestOverallScore: number | null
  confidence: number
  planCount: number
  candidateCount: number
  duplicateCount: number
  fallbackUsed: boolean
  labels: string[]
  explanation: string | null
  durationMs: number
}
