import { createMockSpeechToTextProvider } from './mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from './mockTextToSpeechProvider'
import { createWebSpeechToTextProvider } from './webSpeechToTextProvider'
import { createWebTextToSpeechProvider } from './webTextToSpeechProvider'
import { createAudioElementTextToSpeechProvider } from './audioElementTextToSpeechProvider'
import type { SpeechToTextProvider, TextToSpeechProvider } from './voiceTypes'

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
 * - audio → HTMLAudioElement via /api/tts (reliable; preferred)
 * - web → speechSynthesis (fallback)
 * - auto → audio when Audio exists, else web, else mock
 */
export function createTextToSpeechProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_TTS_PROVIDER'),
): TextToSpeechProvider {
  if (kind === 'mock') return createMockTextToSpeechProvider()
  if (kind === 'web') return createWebTextToSpeechProvider()
  if (kind === 'audio') return createAudioElementTextToSpeechProvider()

  const audio = createAudioElementTextToSpeechProvider()
  if (audio.isSupported()) {
    const web = createWebTextToSpeechProvider()
    return createFailoverTextToSpeechProvider(audio, web.isSupported() ? web : null)
  }
  const web = createWebTextToSpeechProvider()
  return web.isSupported() ? web : createMockTextToSpeechProvider()
}

/** Try primary (MP3) first; on failure fall back to Web Speech. */
function createFailoverTextToSpeechProvider(
  primary: TextToSpeechProvider,
  fallback: TextToSpeechProvider | null,
): TextToSpeechProvider {
  let speaking = false
  return {
    providerId: `failover:${primary.providerId}${fallback ? `+${fallback.providerId}` : ''}`,
    isSupported: () => primary.isSupported() || !!fallback?.isSupported(),
    async speak(options) {
      speaking = true
      try {
        await primary.speak(options)
      } catch (primaryError) {
        if (!fallback) {
          speaking = false
          throw primaryError
        }
        await fallback.speak(options)
      } finally {
        speaking = primary.isSpeaking() || !!fallback?.isSpeaking()
        if (!primary.isSpeaking() && !fallback?.isSpeaking()) speaking = false
      }
    },
    stop() {
      primary.stop()
      fallback?.stop()
      speaking = false
    },
    isSpeaking() {
      return speaking || primary.isSpeaking() || !!fallback?.isSpeaking()
    },
  }
}
