import { createMockSpeechToTextProvider } from './mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from './mockTextToSpeechProvider'
import { createWebSpeechToTextProvider } from './webSpeechToTextProvider'
import { createWebTextToSpeechProvider } from './webTextToSpeechProvider'
import { createAudioElementTextToSpeechProvider } from './audioElementTextToSpeechProvider'
import type { SpeechToTextProvider, TextToSpeechProvider } from './voiceTypes'
import { logChat } from '../chatLogger'

export type VoiceProviderKind = 'auto' | 'web' | 'mock' | 'audio'

function readKind(envKey: string): VoiceProviderKind {
  const raw = (import.meta.env[envKey] as string | undefined)?.trim().toLowerCase()
  if (raw === 'web' || raw === 'mock' || raw === 'auto' || raw === 'audio') return raw
  return 'auto'
}

export function createSpeechToTextProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_STT_PROVIDER'),
): SpeechToTextProvider {
  if (kind === 'mock') return createMockSpeechToTextProvider().provider
  if (kind === 'web') return createWebSpeechToTextProvider()
  const web = createWebSpeechToTextProvider()
  return web.isSupported() ? web : createMockSpeechToTextProvider().provider
}

/**
 * TTS selection:
 * - audio → HTMLAudioElement via OpenAI /api/openai/tts (only happy path)
 * - web → speechSynthesis (explicit opt-in / last resort)
 * - auto → OpenAI audio path only (no silent Web Speech failover)
 */
export function createTextToSpeechProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_TTS_PROVIDER'),
): TextToSpeechProvider {
  if (kind === 'mock') return createMockTextToSpeechProvider()
  if (kind === 'web') return createWebTextToSpeechProvider()
  if (kind === 'audio') return createAudioElementTextToSpeechProvider()

  const audio = createAudioElementTextToSpeechProvider()
  if (audio.isSupported()) {
    // Do not wrap with silent Web Speech failover — OpenAI owns speech while healthy.
    return createLoggingTextToSpeechProvider(audio)
  }
  const web = createWebTextToSpeechProvider()
  if (web.isSupported()) {
    logChat('warn', 'tts', 'openai_audio_unsupported_using_web_speech')
    return web
  }
  return createMockTextToSpeechProvider()
}

/** Log TTS failures instead of silently swapping engines. */
function createLoggingTextToSpeechProvider(primary: TextToSpeechProvider): TextToSpeechProvider {
  return {
    providerId: primary.providerId,
    isSupported: () => primary.isSupported(),
    prefetch(options) {
      primary.prefetch?.(options)
    },
    async speak(options) {
      try {
        await primary.speak(options)
      } catch (primaryError) {
        logChat('error', 'tts', 'primary_tts_failed_no_silent_fallback', {
          providerId: primary.providerId,
          message: primaryError instanceof Error ? primaryError.message : String(primaryError),
        })
        throw primaryError
      }
    },
    stop() {
      primary.stop()
    },
    isSpeaking() {
      return primary.isSpeaking()
    },
  }
}
