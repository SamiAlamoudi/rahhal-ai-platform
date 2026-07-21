/**
 * Sprint 80 — Adaptive Learning Engine (online preference adaptation).
 */

import {
  appendBehavior,
  completeLearningSession,
  derivePreferenceWeightBiases,
  getOrCreateProfile,
  getPreferenceStore,
  startLearningSession,
  type PreferenceStore,
  type TravelerProfile,
  type PreferenceEntry,
  type LearningSession,
} from '../profile'
import { decreaseConfidence, increaseConfidence, snapConfidence } from './ConfidenceAdjuster'
import { analyzeRepeatedBehavior } from './BehaviorAnalyzer'
import { processFeedback, type FeedbackInput } from './FeedbackProcessor'
import {
  inferPreferencesFromText,
  preferenceKey,
  type InferredPreferenceSignal,
} from './PreferenceInference'
import { emitLearningEvent, type LearningEvent } from './events'
import { SPRINT80_ADAPTIVE_LEARNING_VERSION } from '../profile/TravelerProfile'

export interface AdaptiveLearningResult {
  version: string
  profile: TravelerProfile
  session: LearningSession
  inferred: InferredPreferenceSignal[]
  events: LearningEvent[]
  durationMs: number
}

function upsertPreference(
  profile: TravelerProfile,
  signal: InferredPreferenceSignal,
  events?: LearningEvent[],
): { profile: TravelerProfile; updated: boolean } {
  const now = new Date().toISOString()
  const key = preferenceKey(signal)
  const index = profile.preferences.findIndex((p) => preferenceKey(p) === key)
  let preferences = [...profile.preferences]
  let updated = false

  if (index < 0) {
    const created: PreferenceEntry = {
      kind: signal.kind,
      value: signal.value,
      polarity: signal.polarity,
      confidence: snapConfidence(0.1),
      observations: 1,
      updatedAt: now,
      source: signal.source,
    }
    preferences.push(created)
    updated = true
    emitLearningEvent('preference.inferred', {
      kind: signal.kind,
      value: signal.value,
      confidence: created.confidence,
    }, events)
    emitLearningEvent('confidence.updated', {
      kind: signal.kind,
      value: signal.value,
      confidence: created.confidence,
    }, events)
  } else {
    const current = preferences[index]!
    if (current.polarity === signal.polarity) {
      const nextConf = increaseConfidence(current.confidence)
      preferences[index] = {
        ...current,
        confidence: nextConf,
        observations: current.observations + 1,
        updatedAt: now,
        source: signal.source,
      }
      updated = nextConf !== current.confidence || true
      emitLearningEvent('confidence.updated', {
        kind: signal.kind,
        value: signal.value,
        confidence: nextConf,
        previous: current.confidence,
      }, events)
    } else {
      // Opposite behavior — decay; flip only when weak
      const decayed = decreaseConfidence(current.confidence)
      if (decayed <= 0.25) {
        preferences[index] = {
          kind: signal.kind,
          value: signal.value,
          polarity: signal.polarity,
          confidence: snapConfidence(0.1),
          observations: 1,
          updatedAt: now,
          source: signal.source,
        }
      } else {
        preferences[index] = {
          ...current,
          confidence: decayed,
          observations: current.observations + 1,
          updatedAt: now,
        }
      }
      updated = true
      emitLearningEvent('confidence.updated', {
        kind: signal.kind,
        value: signal.value,
        confidence: preferences[index]!.confidence,
        conflict: true,
      }, events)
    }
  }

  const nextProfile: TravelerProfile = {
    ...profile,
    preferences,
    weightBiases: {},
    updatedAt: now,
  }
  nextProfile.weightBiases = derivePreferenceWeightBiases(nextProfile)
  return { profile: nextProfile, updated }
}

export class AdaptiveLearningEngine {
  constructor(private readonly store: PreferenceStore = getPreferenceStore()) {}

  learn(input: {
    userId: string
    userText?: string | null
    feedback?: FeedbackInput | FeedbackInput[]
    behaviorPayload?: Record<string, unknown>
  }): AdaptiveLearningResult {
    const started = Date.now()
    const events: LearningEvent[] = []
    let session = startLearningSession(input.userId)
    emitLearningEvent('learning.started', { userId: input.userId, sessionId: session.sessionId }, events)

    let profile = getOrCreateProfile(input.userId, this.store)
    session = { ...session, learningEnabled: profile.learningEnabled }

    if (!profile.learningEnabled) {
      session = completeLearningSession(session, {
        eventsProcessed: 0,
        preferencesUpdated: 0,
        learningEnabled: false,
      })
      emitLearningEvent('learning.completed', { userId: input.userId, disabled: true }, events)
      return {
        version: SPRINT80_ADAPTIVE_LEARNING_VERSION,
        profile,
        session,
        inferred: [],
        events,
        durationMs: Date.now() - started,
      }
    }

    let eventsProcessed = 0
    let preferencesUpdated = 0
    const inferred: InferredPreferenceSignal[] = []

    if (input.userText) {
      profile = appendBehavior(profile, 'conversation', { text: input.userText })
      const fromText = inferPreferencesFromText(input.userText)
      inferred.push(...fromText)
      eventsProcessed += 1
    }

    const feedbackList = input.feedback
      ? Array.isArray(input.feedback) ? input.feedback : [input.feedback]
      : []
    for (const fb of feedbackList) {
      profile = appendBehavior(profile, fb.type, { ...fb })
      inferred.push(...processFeedback(fb))
      eventsProcessed += 1
    }

    if (input.behaviorPayload) {
      profile = appendBehavior(profile, 'repeated_behavior', input.behaviorPayload)
      eventsProcessed += 1
    }

    // Persist intermediate history so analyzer sees new events
    this.store.save(profile)
    profile = getOrCreateProfile(input.userId, this.store)
    inferred.push(...analyzeRepeatedBehavior(profile))

    for (const signal of inferred) {
      const result = upsertPreference(profile, signal, events)
      profile = result.profile
      if (result.updated) preferencesUpdated += 1
    }

    profile = this.store.save(profile)
    emitLearningEvent('profile.updated', {
      userId: input.userId,
      preferenceCount: profile.preferences.length,
      preferencesUpdated,
    }, events)

    session = completeLearningSession(session, {
      eventsProcessed,
      preferencesUpdated,
      learningEnabled: true,
    })
    emitLearningEvent('learning.completed', {
      userId: input.userId,
      sessionId: session.sessionId,
      preferencesUpdated,
    }, events)

    return {
      version: SPRINT80_ADAPTIVE_LEARNING_VERSION,
      profile,
      session,
      inferred,
      events,
      durationMs: Date.now() - started,
    }
  }

  resetProfile(userId: string): void {
    this.store.reset(userId)
    emitLearningEvent('profile.updated', { userId, reset: true })
  }

  setLearningEnabled(userId: string, enabled: boolean): TravelerProfile | null {
    return this.store.setLearningEnabled(userId, enabled)
  }

  getProfile(userId: string): TravelerProfile | null {
    return this.store.get(userId)
  }
}

export function createAdaptiveLearningEngine(store?: PreferenceStore): AdaptiveLearningEngine {
  return new AdaptiveLearningEngine(store)
}

export function runAdaptiveLearning(
  input: Parameters<AdaptiveLearningEngine['learn']>[0],
  store?: PreferenceStore,
): AdaptiveLearningResult {
  return createAdaptiveLearningEngine(store).learn(input)
}
