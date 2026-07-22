/**
 * Sprint 112 — MemoryRunner
 * Feature-flag gate: OFF → disabled (legacy behavior unchanged).
 */

import {
  createConversationMemory,
  getConversationMemoryStore,
  getOrCreateConversationMemory,
  recordConversationTurn,
  recordRecommendationOutcome,
  recordSearch,
  resetConversationMemoryStore,
  type ConversationMemoryStore,
} from './ConversationMemory'
import { extractPreferencesFromMessages } from './PreferenceExtractor'
import { resolvePreferences } from './PreferenceResolver'
import { scoreCandidates } from './PreferenceScorer'
import {
  getOrCreateMemoryProfile,
  getPreferenceStore,
  resetPreferenceStore,
  type PreferenceStore,
} from './PreferenceStore'
import { applyPreferenceSignals } from './PreferenceUpdater'
import { generateTravelHistory } from './TravelHistory'
import { isMemoryEngineEnabled } from './feature'
import {
  buildMemoryMetadata,
  emptyMemoryMetadata,
  toConciergeMemoryHints,
  toResponseComposerMemoryNotes,
} from './MemoryMetadata'
import type {
  MemoryEngineInput,
  MemoryEngineResult,
  MemoryLogEntry,
  MemoryStructuredLogger,
} from './types'
import {
  createSilentMemoryLogger,
  SPRINT112_MEMORY_ENGINE_VERSION,
} from './types'

export interface MemoryRunnerOptions {
  enabled?: boolean
  logger?: MemoryStructuredLogger
  preferenceStore?: PreferenceStore
  conversationStore?: ConversationMemoryStore
}

function disabledResult(_input: MemoryEngineInput): MemoryEngineResult {
  return {
    version: SPRINT112_MEMORY_ENGINE_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    profile: null,
    conversationMemory: null,
    travelHistory: null,
    extracted: [],
    resolution: null,
    scores: [],
    metadata: emptyMemoryMetadata(),
    conciergeHints: [],
    responseComposerNotes: [],
    validationErrors: [],
    logs: ['memory_engine_disabled'],
    latencyMs: 0,
  }
}

export class MemoryRunner {
  private readonly options: MemoryRunnerOptions
  private readonly logger: MemoryStructuredLogger
  private readonly logs: MemoryLogEntry[] = []

  constructor(options: MemoryRunnerOptions = {}) {
    this.options = options
    this.logger = options.logger ?? createSilentMemoryLogger()
  }

  getStructuredLogs(): readonly MemoryLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  private emit(
    level: MemoryLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: MemoryLogEntry = {
      at: new Date().toISOString(),
      level,
      message,
      meta,
    }
    this.logs.push(entry)
    this.logger(entry)
  }

  run(input: MemoryEngineInput): MemoryEngineResult {
    const started = Date.now()

    if (!isMemoryEngineEnabled({ enabled: this.options.enabled })) {
      this.emit('info', 'memory_engine.disabled')
      return disabledResult(input)
    }

    const validationErrors: string[] = []
    const userId = typeof input.userId === 'string' ? input.userId.trim() : ''
    if (!userId) {
      validationErrors.push('userId is required')
      this.emit('warn', 'memory_engine.invalid', { validationErrors })
      return {
        version: SPRINT112_MEMORY_ENGINE_VERSION,
        enabled: true,
        ok: false,
        empty: true,
        profile: null,
        conversationMemory: null,
        travelHistory: null,
        extracted: [],
        resolution: null,
        scores: [],
        metadata: emptyMemoryMetadata(),
        conciergeHints: [],
        responseComposerNotes: [],
        validationErrors,
        logs: this.logs.map((l) => l.message),
        latencyMs: Date.now() - started,
      }
    }

    this.emit('info', 'memory_engine.start', {
      userId,
      messageCount: input.messages?.length ?? 0,
      candidateCount: input.candidates?.length ?? 0,
    })

    const preferenceStore =
      this.options.preferenceStore ?? getPreferenceStore()
    const conversationStore =
      this.options.conversationStore ?? getConversationMemoryStore()
    const conversationMemoryApi = createConversationMemory(conversationStore)

    let profile = getOrCreateMemoryProfile(userId, preferenceStore)
    let conversationMemory = getOrCreateConversationMemory(
      userId,
      conversationStore,
    )

    const conversationId =
      input.conversationId?.trim() || `conv_${userId}_${Date.now()}`

    // Record user messages into conversation memory
    for (const msg of input.messages ?? []) {
      if (!msg.text?.trim()) continue
      conversationMemory = recordConversationTurn(conversationMemory, {
        conversationId,
        role: msg.role === 'assistant' || msg.role === 'system'
          ? msg.role
          : 'user',
        text: msg.text,
      })
    }

    const extracted = extractPreferencesFromMessages(input.messages ?? [])
    const persist = input.persist !== false
    if (extracted.length > 0 && persist) {
      profile = applyPreferenceSignals(profile, extracted)
      profile = preferenceStore.save(profile)
      this.emit('info', 'memory_engine.preferences_updated', {
        extractedCount: extracted.length,
      })
    }

    if (input.search) {
      conversationMemory = recordSearch(conversationMemory, {
        conversationId,
        origin: input.search.origin ?? null,
        destination: input.search.destination ?? null,
        departureDate: input.search.departureDate ?? null,
        returnDate: input.search.returnDate ?? null,
        budget: input.search.budget ?? null,
        currency: input.search.currency ?? null,
      })
    }

    for (const outcome of input.recommendationOutcomes ?? []) {
      conversationMemory = recordRecommendationOutcome(conversationMemory, {
        conversationId,
        ...outcome,
      })
    }

    conversationMemory = conversationMemoryApi.save(conversationMemory)

    const resolution = resolvePreferences({
      profile,
      explicit: input.explicit,
    })

    const travelHistory = generateTravelHistory({
      profile,
      conversationMemory,
    })

    const scores = scoreCandidates({
      candidates: input.candidates ?? [],
      resolution,
      history: travelHistory,
      conversationMemory,
    })

    const metadata = buildMemoryMetadata({
      resolution,
      scores,
      extractedCount: extracted.length,
      profileUserId: profile.userId,
      hasProfile: true,
      hasConversationMemory: conversationMemory.conversationIds.length > 0,
      hasHistory: travelHistory.tripCount > 0,
    })

    const conciergeHints = toConciergeMemoryHints(metadata)
    const responseComposerNotes = toResponseComposerMemoryNotes(metadata)

    const empty =
      extracted.length === 0
      && (input.candidates?.length ?? 0) === 0
      && travelHistory.tripCount === 0
      && resolution.matchedPreferences.length === 0

    this.emit('info', 'memory_engine.done', {
      extractedCount: extracted.length,
      scoredCount: scores.length,
      matched: metadata.matchedPreferences.length,
    })

    return {
      version: SPRINT112_MEMORY_ENGINE_VERSION,
      enabled: true,
      ok: true,
      empty,
      profile,
      conversationMemory,
      travelHistory,
      extracted,
      resolution,
      scores,
      metadata,
      conciergeHints,
      responseComposerNotes,
      validationErrors,
      logs: this.logs.map((l) => l.message),
      latencyMs: Date.now() - started,
    }
  }
}

export function createMemoryRunner(
  options?: MemoryRunnerOptions,
): MemoryRunner {
  return new MemoryRunner(options)
}

export function runMemoryEngine(
  input: MemoryEngineInput,
  options?: MemoryRunnerOptions,
): MemoryEngineResult {
  return createMemoryRunner(options).run(input)
}

/** Reset process-local stores (tests). */
export function resetMemoryEngineStores(): void {
  resetPreferenceStore()
  resetConversationMemoryStore()
}
