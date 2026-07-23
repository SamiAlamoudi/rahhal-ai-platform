import { createMockSpeechToTextProvider } from './mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from './mockTextToSpeechProvider'
import { createWebSpeechToTextProvider } from './webSpeechToTextProvider'
import { createWebTextToSpeechProvider } from './webTextToSpeechProvider'
import type { SpeechToTextProvider, TextToSpeechProvider } from './voiceTypes'

export type VoiceProviderKind = 'auto' | 'web' | 'mock'

export type SpeechToTextResolution = {
  provider: SpeechToTextProvider
  /** Effective provider in use. */
  kind: 'web' | 'mock'
  /** True when auto mode fell back because Web Speech API is missing. */
  usingFallbackMock: boolean
}

function readKind(envKey: string): VoiceProviderKind {
  const raw = (import.meta.env[envKey] as string | undefined)?.trim().toLowerCase()
  if (raw === 'web' || raw === 'mock' || raw === 'auto') return raw
  return 'auto'
}

export function isWebSpeechRecognitionAvailable(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
  }
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

export function resolveSpeechToTextProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_STT_PROVIDER'),
): SpeechToTextResolution {
  if (kind === 'mock') {
    return {
      provider: createMockSpeechToTextProvider().provider,
      kind: 'mock',
      usingFallbackMock: false,
    }
  }
  if (kind === 'web') {
    return {
      provider: createWebSpeechToTextProvider(),
      kind: 'web',
      usingFallbackMock: false,
    }
  }
  const web = createWebSpeechToTextProvider()
  if (web.isSupported()) {
    return { provider: web, kind: 'web', usingFallbackMock: false }
  }
  // Prefer the real web provider (isSupported=false) so the UI can show a clear
  // unsupported state instead of silently accepting fake mock transcripts.
  return {
    provider: web,
    kind: 'web',
    usingFallbackMock: true,
  }
}

export function createSpeechToTextProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_STT_PROVIDER'),
): SpeechToTextProvider {
  // Explicit mock remains available for tests / demos.
  if (kind === 'mock') return createMockSpeechToTextProvider().provider
  return resolveSpeechToTextProvider(kind).provider
}

export function createTextToSpeechProvider(
  kind: VoiceProviderKind = readKind('VITE_VOICE_TTS_PROVIDER'),
): TextToSpeechProvider {
  if (kind === 'mock') return createMockTextToSpeechProvider()
  if (kind === 'web') return createWebTextToSpeechProvider()
  const web = createWebTextToSpeechProvider()
  return web.isSupported() ? web : createMockTextToSpeechProvider()
}
