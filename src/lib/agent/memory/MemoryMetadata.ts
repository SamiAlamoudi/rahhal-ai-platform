/**
 * Sprint 112 — MemoryMetadata + Concierge / Response Composer adapters.
 */

import type {
  MemoryEngineResult,
  MemoryMetadata,
  PreferenceResolution,
  PreferenceScoreBreakdown,
} from './types'

export function buildMemoryMetadata(input: {
  resolution: PreferenceResolution | null
  scores: PreferenceScoreBreakdown[]
  extractedCount: number
  profileUserId: string | null
  hasProfile: boolean
  hasConversationMemory: boolean
  hasHistory: boolean
}): MemoryMetadata {
  const resolution = input.resolution
  let memorySource: MemoryMetadata['memorySource'] = 'none'
  if (input.hasProfile && input.hasConversationMemory) memorySource = 'merged'
  else if (input.hasProfile) memorySource = 'profile'
  else if (input.hasConversationMemory) memorySource = 'conversation'
  else if (input.hasHistory) memorySource = 'history'

  const confidences = input.scores.map((s) => s.total)
  const confidence =
    confidences.length > 0
      ? Math.round(
        (confidences.reduce((a, b) => a + b, 0) / confidences.length) * 1000,
      ) / 1000
      : resolution
        ? 0.45
        : 0

  return {
    matchedPreferences: resolution?.matchedPreferences.slice() ?? [],
    ignoredPreferences: resolution?.ignoredPreferences.slice() ?? [],
    confidence,
    memorySource,
    reasoningSummary:
      resolution?.reasoningSummary
      ?? 'No memory preferences resolved for this turn.',
    profileUserId: input.profileUserId,
    extractedCount: input.extractedCount,
    scoredCount: input.scores.length,
  }
}

/** Concierge-ready hints (Concierge may explain using these; Concierge unchanged). */
export function toConciergeMemoryHints(metadata: MemoryMetadata): string[] {
  const hints: string[] = []
  if (metadata.matchedPreferences.length > 0) {
    hints.push(
      'I selected this itinerary because it matches your previous travel preferences.',
    )
    hints.push(
      `Matched preference groups: ${metadata.matchedPreferences.join(', ')}.`,
    )
  }
  if (metadata.ignoredPreferences.length > 0) {
    hints.push(
      `Current request overrides ignored stored preferences: ${metadata.ignoredPreferences.join(', ')}.`,
    )
  }
  if (metadata.reasoningSummary) {
    hints.push(metadata.reasoningSummary)
  }
  return hints
}

/** Response Composer may consume these notes additively. */
export function toResponseComposerMemoryNotes(metadata: MemoryMetadata): string[] {
  const notes: string[] = []
  if (metadata.matchedPreferences.length > 0) {
    notes.push(`memory_matched:${metadata.matchedPreferences.join('|')}`)
  }
  if (metadata.ignoredPreferences.length > 0) {
    notes.push(`memory_ignored:${metadata.ignoredPreferences.join('|')}`)
  }
  notes.push(`memory_source:${metadata.memorySource}`)
  notes.push(`memory_confidence:${metadata.confidence}`)
  return notes
}

export function emptyMemoryMetadata(): MemoryMetadata {
  return {
    matchedPreferences: [],
    ignoredPreferences: [],
    confidence: 0,
    memorySource: 'none',
    reasoningSummary: '',
    profileUserId: null,
    extractedCount: 0,
    scoredCount: 0,
  }
}

export function summarizeMemoryResult(result: MemoryEngineResult): string {
  if (!result.enabled) return 'Memory engine disabled'
  if (!result.ok) return 'Memory engine inactive or empty'
  return result.metadata.reasoningSummary
}

export class MemoryMetadataBuilder {
  build(input: Parameters<typeof buildMemoryMetadata>[0]): MemoryMetadata {
    return buildMemoryMetadata(input)
  }
}

export function createMemoryMetadataBuilder(): MemoryMetadataBuilder {
  return new MemoryMetadataBuilder()
}
