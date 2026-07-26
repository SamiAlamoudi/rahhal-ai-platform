import { createMockSpeechToTextProvider } from './mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from './mockTextToSpeechProvider'
import { createWebSpeechToTextProvider } from './webSpeechToTextProvider'
import { createWebTextToSpeechProvider } from './webTextToSpeechProvider'
import type { SpeechToTextProvider, TextToSpeechProvider } from './voiceTypes'

export type VoiceProviderKind = 'auto' | 'web' | 'mock'

function readKind(envKey: string): VoiceProviderKind {
  const raw = (import.meta.env[envKey] as string | undefined)?.trim().toLowerCase()
  if (raw === 'web' || raw === 'mock' || raw === 'auto') return raw
  return 'auto'
}

/** True when the browser exposes SpeechRecognition / webkitSpeechRecognition. */
export function isBrowserSpeechRecognitionAvailable(): boolean {
  return createWebSpeechToTextProvider().isSupported()
}

export function createSpeechToTextProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_STT_PROVIDER'),
): SpeechToTextProvider {
  if (kind === 'mock') return createMockSpeechToTextProvider().provider
  if (kind === 'web') return createWebSpeechToTextProvider()
  const web = createWebSpeechToTextProvider()
  // Prefer real Web Speech; gracefully fall back to mock only when unsupported
  // (tests / environments without the API). UI should still surface unsupported.
  return web.isSupported() ? web : createMockSpeechToTextProvider().provider
}

export function createTextToSpeechProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_TTS_PROVIDER'),
): TextToSpeechProvider {
  if (kind === 'mock') return createMockTextToSpeechProvider()
  if (kind === 'web') return createWebTextToSpeechProvider()
  const web = createWebTextToSpeechProvider()
  return web.isSupported() ? web : createMockTextToSpeechProvider()
}
