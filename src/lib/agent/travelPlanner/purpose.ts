/**
 * Sprint 78 — travel purpose refinement from memory + utterance.
 */

import type { AgentMemory } from '../types'
import { detectPlannerIntent, type PlannerIntentSignals } from './intent'
import type { TravelPurpose } from './types'

export function resolveTravelPurpose(
  userText: string | null | undefined,
  memory?: AgentMemory | null,
): PlannerIntentSignals {
  const signals = detectPlannerIntent(userText)
  if (signals.travelPurpose !== 'unknown') return signals

  const purpose = memory?.requirements.tripPurpose
  if (purpose === 'business') {
    return { ...signals, travelPurpose: 'business', travelerType: signals.travelerType === 'unknown' ? 'business' : signals.travelerType, cues: [...signals.cues, 'memory:business'] }
  }
  if (purpose === 'family') {
    return { ...signals, travelPurpose: 'family', travelerType: 'family', cues: [...signals.cues, 'memory:family'] }
  }
  if (purpose === 'honeymoon') {
    return { ...signals, travelPurpose: 'honeymoon', travelerType: 'couple', cues: [...signals.cues, 'memory:honeymoon'] }
  }
  if (purpose === 'leisure') {
    return { ...signals, travelPurpose: 'vacation', cues: [...signals.cues, 'memory:leisure'] }
  }

  const traveler = memory?.requirements.travelerType
  if (traveler === 'business') {
    return { ...signals, travelPurpose: 'business' as TravelPurpose, travelerType: 'business', cues: [...signals.cues, 'traveler:business'] }
  }
  if (traveler === 'family') {
    return { ...signals, travelPurpose: 'family', travelerType: 'family', cues: [...signals.cues, 'traveler:family'] }
  }
  if (traveler === 'couple') {
    return { ...signals, travelerType: 'couple', cues: [...signals.cues, 'traveler:couple'] }
  }

  return signals
}
