/**
 * Evolution Sprint 5 — TravelerModel
 * Evolving behavioral model orchestration (observe → analyze → evolve → snapshot).
 * Not wired into planTurn. CPU-only.
 */

import { isTravelerIntelligenceEnabled } from './travelerFeature'
import { analyzeBehavior } from './behaviorAnalyzer'
import { evolveMany } from './preferenceEvolution'
import { createEmptyProfile, updateProfileFromText } from './travelerProfile'
import { recordConfidencePoint, overallTravelerConfidence } from './travelerConfidence'
import { buildTravelerSnapshot } from './travelerSummary'
import { mergeEvidence } from './preferenceEvidence'
import {
  isoNow,
  newId,
  type TravelerLocale,
  type TravelerModelState,
  type TravelerObserveInput,
  type TravelerSnapshot,
  type PreferenceSignal,
} from './travelerTypes'

export function createTravelerModel(
  locale: TravelerLocale = 'ar',
  now?: Date,
): TravelerModelState {
  const stamp = isoNow(now)
  return {
    id: newId('tmodel', now),
    locale,
    createdAt: stamp,
    updatedAt: stamp,
    profile: createEmptyProfile(locale, now),
    preferences: {},
    evidenceLog: [],
    turnCount: 0,
    confidenceHistory: [],
    lastSources: {
      reasoningRef: null,
      reflectionRef: null,
      conversationSource: null,
    },
  }
}

export function observeTraveler(
  model: TravelerModelState,
  input: TravelerObserveInput,
): { model: TravelerModelState; signals: PreferenceSignal[]; snapshot: TravelerSnapshot } {
  const now = input.now ?? new Date()
  const locale = input.locale ?? model.locale
  const conversationSource = input.conversationSource ?? `turn:${model.turnCount + 1}`
  const reasoningRef = input.reasoningRef ?? null
  const reflectionRef = input.reflectionRef ?? null

  const ctx = {
    text: input.userText,
    locale,
    conversationSource,
    reasoningRef,
    reflectionRef,
    now,
  }

  const signals = analyzeBehavior(ctx)
  model.preferences = evolveMany(model.preferences, signals, now)
  model.profile = updateProfileFromText(model.profile, input.userText, locale, now)
  model.locale = locale
  model.turnCount += 1
  model.updatedAt = isoNow(now)
  model.lastSources = { reasoningRef, reflectionRef, conversationSource }

  const newEvidence = signals.flatMap((s) => s.evidence)
  model.evidenceLog = mergeEvidence(model.evidenceLog, newEvidence, 80)

  recordConfidencePoint(
    model,
    signals.length
      ? `Observed ${signals.length} preference signal(s)`
      : 'Observed turn with no new preference signals',
    now,
  )

  const snapshot = buildTravelerSnapshot(model, now)
  return { model, signals, snapshot }
}

export function tryObserveTraveler(
  model: TravelerModelState,
  input: TravelerObserveInput,
): { model: TravelerModelState; signals: PreferenceSignal[]; snapshot: TravelerSnapshot } | null {
  if (!isTravelerIntelligenceEnabled({ enabled: input.enabled })) return null
  return observeTraveler(model, input)
}

export function tryCreateTravelerModel(
  locale?: TravelerLocale,
  options?: { enabled?: boolean; now?: Date },
): TravelerModelState | null {
  if (!isTravelerIntelligenceEnabled(options)) return null
  return createTravelerModel(locale, options?.now)
}

export const TravelerModel = {
  create: createTravelerModel,
  tryCreate: tryCreateTravelerModel,
  observe: observeTraveler,
  tryObserve: tryObserveTraveler,
  confidence: overallTravelerConfidence,
  snapshot: buildTravelerSnapshot,
}
