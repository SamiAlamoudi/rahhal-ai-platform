/**
 * Agent-facing Adaptive Learning snapshots (Sprint 80).
 */

import type { AdaptiveLearningResult, TravelerProfile } from '../../../core'

export type { AdaptiveLearningResult, TravelerProfile }

export interface AdaptiveLearningMeta {
  learningEnabled: boolean
  preferenceCount: number
  preferencesUpdated: number
  inferredCount: number
  eventsProcessed: number
  topPreferences: Array<{ kind: string; value: string; confidence: number }>
  durationMs: number
}
