/**
 * Phase AA — user feedback collection types (repository-level; no UI redesign).
 */

export type FeedbackKind = 'bug' | 'feature_request' | 'usability' | 'rating'

export type FeedbackPriority = 'low' | 'medium' | 'high' | 'urgent'

export type FeedbackStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'closed'

export interface BugReport {
  kind: 'bug'
  summary: string
  stepsToReproduce?: string | null
  expectedBehavior?: string | null
  actualBehavior?: string | null
}

export interface FeatureRequest {
  kind: 'feature_request'
  summary: string
  useCase?: string | null
}

export interface UserRating {
  kind: 'rating'
  score: number
  comment?: string | null
}

export interface UsabilityIssue {
  kind: 'usability'
  summary: string
  area?: string | null
}

export type FeedbackPayload = BugReport | FeatureRequest | UserRating | UsabilityIssue

export interface FeedbackRecord {
  id: string
  kind: FeedbackKind
  priority: FeedbackPriority
  status: FeedbackStatus
  appVersion: string
  correlationId: string | null
  userId: string | null
  contactEmailMasked: string | null
  summary: string
  details: Record<string, unknown>
  dedupeKey: string | null
  createdAt: string
  updatedAt: string
}

export interface SubmitFeedbackInput {
  payload: FeedbackPayload
  appVersion: string
  correlationId?: string | null
  userId?: string | null
  contactEmail?: string | null
  priority?: FeedbackPriority
  dedupeKey?: string | null
}
