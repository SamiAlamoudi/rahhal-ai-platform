/**
 * Sprint 101 — BookingAssistantComposer
 * Assembles existing Alpha / engine snapshots into a Booking Ready Experience.
 * Presentation / orchestration only — no new travel intelligence.
 */

import { buildBookingActions, type BookingActionsSection } from './BookingActions'
import { buildBookingChecklist, type BookingChecklistSection } from './BookingChecklist'
import {
  buildBookingReadiness,
  SPRINT101_BOOKING_ASSISTANT_VERSION,
  type BookingAssistantComposeInput,
  type BookingReadinessSection,
} from './BookingReadiness'
import { buildBookingAssistantSummary, type BookingSummarySection } from './BookingSummary'
import { buildBookingTimeline, type BookingTimelineSection } from './BookingTimeline'
import { buildBookingWarnings, type BookingWarningsSection } from './BookingWarnings'
import {
  buildMissingRequirements,
  type MissingRequirementsSection,
} from './MissingRequirements'

export { SPRINT101_BOOKING_ASSISTANT_VERSION }
export type { BookingAssistantComposeInput }

export type BookingAssistantSectionId =
  | 'readiness'
  | 'checklist'
  | 'missing_requirements'
  | 'timeline'
  | 'warnings'
  | 'actions'
  | 'confidence'
  | 'summary'

export interface BookingConfidenceSection {
  id: 'confidence'
  score: number
  level: 'high' | 'medium' | 'low'
  label: string
}

export type BookingAssistantSection =
  | BookingReadinessSection
  | BookingChecklistSection
  | MissingRequirementsSection
  | BookingTimelineSection
  | BookingWarningsSection
  | BookingActionsSection
  | BookingConfidenceSection
  | BookingSummarySection

/** Unified Booking Ready Experience for Future UI. */
export interface BookingAssistantDTO {
  version: string
  conversationId: string
  enabled: boolean
  sections: BookingAssistantSection[]
  sectionIds: BookingAssistantSectionId[]
  readinessStatus: BookingReadinessSection['status'] | null
  readyToBook: boolean
  nextAction: string | null
  confidenceScore: number | null
  confidenceLevel: string | null
  durationMs: number
}

function newConversationId(now: number): string {
  return `booking_assist_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function mapLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.75) return 'high'
  if (score >= 0.5) return 'medium'
  return 'low'
}

/**
 * Reuse existing confidence — never invent a new scoring algorithm.
 */
export function buildBookingConfidence(
  input: BookingAssistantComposeInput,
): BookingConfidenceSection | null {
  const raw = input.confidenceScore ?? input.alpha?.confidenceScore ?? null
  if (raw == null || !Number.isFinite(raw)) return null
  const score = raw > 1 ? raw / 100 : raw
  const level = input.confidenceLevel
    ?? (input.alpha?.confidenceLevel as 'high' | 'medium' | 'low' | undefined)
    ?? mapLevel(score)
  const label = input.confidenceLabel
    ?? (level === 'high' ? 'High confidence' : level === 'medium' ? 'Medium confidence' : 'Low confidence')
  return {
    id: 'confidence',
    score,
    level,
    label,
  }
}

export function buildBookingAssistantDTO(
  input: BookingAssistantComposeInput,
  options?: { enabled?: boolean; startedAt?: number },
): BookingAssistantDTO {
  const started = options?.startedAt ?? Date.now()
  const enabled = options?.enabled !== false
  const conversationId = input.conversationId?.trim()
    || input.alpha?.conversationId?.trim()
    || newConversationId(started)

  if (!enabled) {
    return {
      version: SPRINT101_BOOKING_ASSISTANT_VERSION,
      conversationId,
      enabled: false,
      sections: [],
      sectionIds: [],
      readinessStatus: null,
      readyToBook: false,
      nextAction: null,
      confidenceScore: null,
      confidenceLevel: null,
      durationMs: Math.max(0, Date.now() - started),
    }
  }

  const readiness = buildBookingReadiness(input)
  const checklist = buildBookingChecklist(input)
  const missing = buildMissingRequirements(input, readiness, checklist)
  const timeline = buildBookingTimeline(input, readiness)
  const warnings = buildBookingWarnings(input)
  const actions = buildBookingActions(input, readiness, checklist, missing)
  const confidence = buildBookingConfidence(input)
  const summary = buildBookingAssistantSummary(input, actions?.primary ?? null)

  const sections: BookingAssistantSection[] = []
  sections.push(readiness)
  if (checklist) sections.push(checklist)
  if (missing) sections.push(missing)
  if (timeline) sections.push(timeline)
  if (warnings) sections.push(warnings)
  if (confidence) sections.push(confidence)
  if (summary) sections.push(summary)
  if (actions) sections.push(actions)

  return {
    version: SPRINT101_BOOKING_ASSISTANT_VERSION,
    conversationId,
    enabled: true,
    sections,
    sectionIds: sections.map((s) => s.id) as BookingAssistantSectionId[],
    readinessStatus: readiness.status,
    readyToBook: readiness.readyToBook,
    nextAction: actions?.primary.label ?? null,
    confidenceScore: confidence?.score ?? null,
    confidenceLevel: confidence?.level ?? null,
    durationMs: Math.max(0, Date.now() - started),
  }
}

export class BookingAssistantComposer {
  compose(
    input: BookingAssistantComposeInput,
    options?: { enabled?: boolean },
  ): BookingAssistantDTO {
    return buildBookingAssistantDTO(input, { enabled: options?.enabled })
  }
}

export function createBookingAssistantComposer(): BookingAssistantComposer {
  return new BookingAssistantComposer()
}

export function composeBookingAssistantExperience(
  input: BookingAssistantComposeInput,
  options?: { enabled?: boolean },
): BookingAssistantDTO {
  return createBookingAssistantComposer().compose(input, options)
}
