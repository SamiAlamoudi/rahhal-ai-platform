/**
 * Phase AA — feedback manager with classification, PII masking, and dedupe.
 */

import { maskEmail, maskMetadata, maskSensitiveString } from '../logging/mask'
import { getFeedbackRepository, type FeedbackRepository } from './feedbackRepository'
import type {
  FeedbackKind,
  FeedbackPriority,
  FeedbackRecord,
  FeedbackStatus,
  SubmitFeedbackInput,
} from './types'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `fb_${crypto.randomUUID()}`
  }
  return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function classifyPriority(kind: FeedbackKind, input: SubmitFeedbackInput): FeedbackPriority {
  if (input.priority) return input.priority
  if (kind === 'bug') return 'high'
  if (kind === 'usability') return 'medium'
  if (kind === 'feature_request') return 'low'
  return 'low'
}

function sanitizeFeedbackText(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (email) => maskEmail(email))
    .replace(/token[=:]\s*\S+/gi, 'token=[redacted]')
}

function buildDetails(payload: SubmitFeedbackInput['payload']): Record<string, unknown> {
  const base = { ...payload } as Record<string, unknown>
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === 'string') {
      base[key] = sanitizeFeedbackText(maskSensitiveString(value))
    }
  }
  return maskMetadata(base)
}

export class FeedbackManager {
  private readonly repository: FeedbackRepository

  constructor(repository: FeedbackRepository = getFeedbackRepository()) {
    this.repository = repository
  }

  submit(input: SubmitFeedbackInput): FeedbackRecord {
    const kind = input.payload.kind
    const summary = 'summary' in input.payload ? input.payload.summary : 'Feedback'
    const dedupeKey = input.dedupeKey
      ?? (input.userId ? `${kind}:${input.userId}:${summary.slice(0, 80)}` : null)

    const now = new Date().toISOString()
    const record: FeedbackRecord = {
      id: generateId(),
      kind,
      priority: classifyPriority(kind, input),
      status: 'new',
      appVersion: input.appVersion,
      correlationId: input.correlationId ?? null,
      userId: input.userId ?? null,
      contactEmailMasked: input.contactEmail ? maskEmail(input.contactEmail) : null,
      summary: summary.trim(),
      details: buildDetails(input.payload),
      dedupeKey,
      createdAt: now,
      updatedAt: now,
    }
    return this.repository.create(record)
  }

  classify(id: string, priority: FeedbackPriority, status: FeedbackStatus = 'triaged'): FeedbackRecord {
    const updated = this.repository.update(id, { priority, status })
    if (!updated) throw new Error(`Feedback not found: ${id}`)
    return updated
  }

  listForVersion(appVersion: string): FeedbackRecord[] {
    return this.repository.listByVersion(appVersion)
  }

  toSupportView(record: FeedbackRecord): Record<string, unknown> {
    return maskMetadata({
      id: record.id,
      kind: record.kind,
      priority: record.priority,
      status: record.status,
      appVersion: record.appVersion,
      correlationId: record.correlationId,
      summary: record.summary,
      contactEmailMasked: record.contactEmailMasked,
      details: record.details,
    })
  }
}

let defaultManager: FeedbackManager | null = null

export function getFeedbackManager(): FeedbackManager {
  if (!defaultManager) defaultManager = new FeedbackManager()
  return defaultManager
}

export function resetFeedbackManager(): void {
  defaultManager = null
}
