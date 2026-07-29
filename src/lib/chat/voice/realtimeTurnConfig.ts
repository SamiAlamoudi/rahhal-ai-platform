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
 * ChatGPT-Voice-like turn detection WITHOUT auto-response.
 *
 * create_response MUST stay false: on iPhone, silence / breathing / echo after
 * response.done was treated as speech_stopped and spawned unsolicited assistant turns.
 * The client creates a response only after a confirmed ASR transcript (or sendText).
 */
export function buildRealtimeTurnDetection(): Record<string, unknown> {
  return {
    type: 'semantic_vad',
    eagerness: 'low',
    create_response: false,
    interrupt_response: true,
  }
}

/** Fallback server VAD if semantic_vad is unavailable upstream. */
export function buildServerVadFallback(): Record<string, unknown> {
  return {
    type: 'server_vad',
    threshold: 0.65,
    prefix_padding_ms: 280,
    silence_duration_ms: 700,
    create_response: false,
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
