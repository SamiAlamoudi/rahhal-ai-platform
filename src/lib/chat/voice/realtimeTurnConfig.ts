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
 * ChatGPT-Voice-like turn detection WITHOUT auto-response or auto-interrupt.
 *
 * create_response MUST stay false: silence/echo must not spawn turns.
 * interrupt_response MUST stay false: on iPhone speakerphone, echo triggers
 * server-side cancel mid-playback (spoken shorter than displayed text).
 * Manual mic-tap barge-in still calls response.cancel from the client.
 *
 * eagerness=low: tolerate brief Arabic hesitations inside a booking sentence.
 * Client utterance assembly still merges pause-split segment finals.
 */
export function buildRealtimeTurnDetection(): Record<string, unknown> {
  return {
    type: 'semantic_vad',
    eagerness: 'low',
    create_response: false,
    interrupt_response: false,
  }
}

/** Fallback server VAD if semantic_vad is unavailable upstream. */
export function buildServerVadFallback(): Record<string, unknown> {
  return {
    type: 'server_vad',
    threshold: 0.6,
    prefix_padding_ms: 300,
    // ~1.2s silence — allow short pauses in dates/numbers without finalizing.
    silence_duration_ms: 1200,
    create_response: false,
    interrupt_response: false,
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
