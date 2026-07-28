/**
 * Shared Realtime turn-detection + voice mapping.
 * Config only — does not change the WebRTC / Realtime architecture.
 */

import type { VoiceExperiencePrefs, OpenAiTtsVoiceId } from './voiceExperiencePrefs'

/** Voices known to work well on public Realtime output. */
const REALTIME_VOICES = new Set<string>([
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
])

/**
 * ChatGPT-Voice-like turn detection:
 * semantic_vad finishes when the utterance is complete (not fixed silence only),
 * interrupt_response cancels assistant audio the moment the traveler speaks.
 */
export function buildRealtimeTurnDetection(): Record<string, unknown> {
  return {
    type: 'semantic_vad',
    eagerness: 'medium',
    create_response: true,
    interrupt_response: true,
  }
}

/** Fallback server VAD if semantic_vad is unavailable upstream. */
export function buildServerVadFallback(): Record<string, unknown> {
  return {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 280,
    // Closer to OpenAI default (500) than our prior 700 — feels more instantaneous.
    silence_duration_ms: 520,
    create_response: true,
    interrupt_response: true,
  }
}

export function mapPrefsToRealtimeVoice(prefs: VoiceExperiencePrefs): string {
  const id = prefs.voiceId
  if (REALTIME_VOICES.has(id)) {
    if (prefs.gender === 'male' && id !== 'cedar' && id !== 'echo' && id !== 'ash') {
      return 'cedar'
    }
    if (prefs.gender === 'female' && (id === 'cedar' || id === 'echo' || id === 'ash' || id === 'onyx')) {
      return 'marin'
    }
    return id
  }
  if (id === 'onyx' || prefs.gender === 'male') return 'cedar'
  return 'marin'
}

export function isRealtimeVoiceId(id: OpenAiTtsVoiceId | string): boolean {
  return REALTIME_VOICES.has(id)
}
