/**
 * Sprint 116 — StreamingStatus
 */

export type StreamingEventKind =
  | 'started'
  | 'progress'
  | 'completed'
  | 'warning'
  | 'error'
  | 'skipped'

export type StreamingStageStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'warning'
  | 'error'
  | 'skipped'
  | 'timed_out'

export type StreamingProgressPercent = 0 | 25 | 50 | 75 | 100

export const STREAMING_PROGRESS_STEPS: readonly StreamingProgressPercent[] = [
  0, 25, 50, 75, 100,
] as const

export function normalizeProgress(value: number): StreamingProgressPercent {
  if (value >= 100) return 100
  if (value >= 75) return 75
  if (value >= 50) return 50
  if (value >= 25) return 25
  return 0
}
