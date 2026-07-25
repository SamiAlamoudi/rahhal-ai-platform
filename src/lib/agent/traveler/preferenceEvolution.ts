/**
 * Evolution Sprint 5 — PreferenceEvolution
 * Weighted confidence updates — never overwrite immediately.
 * Supports contradictory evidence by retaining prior values.
 */

import { clamp01, clampLean, isoNow, type PreferenceSignal, type StoredPreference } from './travelerTypes'
import { mergeEvidence } from './preferenceEvidence'

const VALUE_DISTANCE_THRESHOLD = 0.35

function valuesConflict(
  prev: StoredPreference,
  signal: PreferenceSignal,
): boolean {
  if (prev.value !== signal.value && prev.value !== 'unknown' && signal.value !== 'unknown') {
    // Categorical mismatch with meaningful lean divergence
    if (Math.abs(prev.lean - signal.lean) >= VALUE_DISTANCE_THRESHOLD) return true
    // Opposite categorical labels (high vs low)
    if (
      (prev.value === 'high' && signal.value === 'low')
      || (prev.value === 'low' && signal.value === 'high')
      || (prev.value === 'cities' && signal.value === 'nature')
      || (prev.value === 'nature' && signal.value === 'cities')
      || (prev.value === 'packed' && signal.value === 'relaxed')
      || (prev.value === 'relaxed' && signal.value === 'packed')
    ) {
      return true
    }
  }
  return Math.abs(prev.lean - signal.lean) >= 0.75 && prev.confidence >= 0.4
}

/**
 * Blend prior preference with new signal.
 * newConfidence = clamp(prior*0.65 + signal*0.35 + agreementBonus)
 * lean = weighted average by confidence weights
 */
export function evolvePreference(
  prior: StoredPreference | undefined,
  signal: PreferenceSignal,
  now?: Date,
): StoredPreference {
  const stamp = isoNow(now)
  if (!prior) {
    return {
      key: signal.key,
      value: signal.value,
      lean: clampLean(signal.lean),
      confidence: clamp01(signal.confidence * 0.85),
      evidence: mergeEvidence([], signal.evidence),
      updatedAt: stamp,
      contradictions: [],
    }
  }

  const conflict = valuesConflict(prior, signal)
  const contradictions = [...prior.contradictions]
  if (conflict) {
    contradictions.push({
      value: prior.value,
      lean: prior.lean,
      confidence: prior.confidence,
      timestamp: stamp,
      evidenceIds: prior.evidence.slice(-3).map((e) => e.id),
    })
  }

  const priorW = prior.confidence * 0.65
  const signalW = signal.confidence * (conflict ? 0.45 : 0.35)
  const totalW = priorW + signalW || 1
  const lean = clampLean((prior.lean * priorW + signal.lean * signalW) / totalW)

  // Value: adopt signal only if stronger confidence or soft agreement; else keep prior label with blended lean
  let value = prior.value
  if (!conflict && signal.confidence >= prior.confidence * 0.9) {
    value = signal.value
  } else if (conflict && signal.confidence > prior.confidence + 0.15) {
    value = signal.value
  } else if (!conflict) {
    value = signal.confidence >= 0.55 ? signal.value : prior.value
  }

  const agreementBonus = conflict ? -0.05 : 0.04
  const confidence = clamp01(prior.confidence * 0.65 + signal.confidence * 0.35 + agreementBonus)

  return {
    key: signal.key,
    value,
    lean,
    confidence,
    evidence: mergeEvidence(prior.evidence, signal.evidence),
    updatedAt: stamp,
    contradictions: contradictions.slice(-12),
  }
}

export function evolveMany(
  store: Partial<Record<string, StoredPreference>>,
  signals: PreferenceSignal[],
  now?: Date,
): Partial<Record<string, StoredPreference>> {
  const next = { ...store }
  for (const signal of signals) {
    next[signal.key] = evolvePreference(store[signal.key], signal, now)
  }
  return next as Partial<Record<import('./travelerTypes').PreferenceKey, StoredPreference>>
}

export const PreferenceEvolution = {
  evolve: evolvePreference,
  evolveMany,
  valuesConflict,
}
