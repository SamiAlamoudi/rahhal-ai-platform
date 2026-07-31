/**
 * Voice Architecture — classic TTS vs Realtime speech-to-speech.
 *
 * Official OpenAI guidance (Realtime and audio overview):
 * - Low-latency voice agents → gpt-realtime-2.1 (speech-to-speech)
 * - Generate speech from text → gpt-4o-mini-tts (request-based TTS)
 *
 * ChatGPT Voice (GPT-Live) is NOT on the public API as of OpenAI's
 * "Introducing GPT-Live" announcement — API access is "planned soon".
 */

export type VoiceArchitectureKind = 'realtime_speech_to_speech' | 'classic_tts'

export const REALTIME_PUBLIC_MODEL = 'gpt-realtime-2.1'
export const CLASSIC_TTS_MODEL = 'gpt-4o-mini-tts'

export const VOICE_ARCHITECTURE_EVIDENCE = {
  ttsBottleneck: [
    'OpenAI Text-to-speech guide: gpt-4o-mini-tts converts finished text → audio (request-based).',
    'Official note: TTS voices are currently optimized for English.',
    'TTS cannot hear user prosody/emotion; it only reads assistant text after Chat Completions.',
    'Therefore gpt-4o-mini-tts cannot match ChatGPT Voice naturalness — the pipeline architecture is the limit, not coral/nova voice choice.',
  ],
  realtimePublicApi: [
    'OpenAI Realtime overview: voice agents should use gpt-realtime-2.1 on /v1/realtime (speech-to-speech).',
    'Realtime conversations guide: voice-to-voice without intermediate STT/TTS preserves tone and lowers latency.',
    'Recommended realtime voices for best quality: marin or cedar.',
  ],
  chatgptVoiceNotOnApi: [
    'OpenAI “Introducing GPT-Live” (2026-07-08): GPT-Live-1 / GPT-Live-1 mini power ChatGPT Voice.',
    'Exact quote commitment: “We also plan to bring them to the API soon.” — no public model id/endpoint/pricing at announcement.',
    'Therefore exact ChatGPT Voice / GPT-Live quality cannot be reproduced via public APIs today.',
  ],
} as const

export function resolvePreferredVoiceArchitecture(
  envValue: string | undefined | null,
): VoiceArchitectureKind {
  const raw = (envValue || '').trim().toLowerCase()
  if (raw === 'tts' || raw === 'classic' || raw === 'classic_tts') return 'classic_tts'
  // Default: highest-quality public speech architecture.
  return 'realtime_speech_to_speech'
}

export type RealtimeCapability = {
  configured: boolean
  model: string
  architecture: string
  chatgptVoiceParity?: {
    gptLiveOnPublicApi: boolean
    evidence: string
    highestPublicVoiceAgentModel: string
  }
}

export async function probeRealtimeCapability(
  fetchImpl: typeof fetch = fetch,
): Promise<RealtimeCapability | null> {
  try {
    const { requireProxyAuthHeaders } = await import('../../security/proxyAuth')
    const headers = await requireProxyAuthHeaders()
    const res = await fetchImpl('/api/openai/realtime-session', {
      method: 'GET',
      headers,
    })
    if (!res.ok) return null
    return await res.json() as RealtimeCapability
  } catch {
    return null
  }
}
