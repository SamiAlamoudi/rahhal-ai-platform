/**
 * Voice Conversation types — input surface over the shared chatEngine.
 * No separate conversation/message store. Phone/video calling are out of scope.
 */

export type VoiceLocale = 'ar' | 'en'
export type VoiceInputMode = 'push_to_talk' | 'hands_free'
/** ChatGPT-like voice states (Listening → Thinking → Responding → Speaking). */
export type VoiceSessionStatus =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'processing' // legacy alias kept for compatibility; prefer thinking/responding
  | 'speaking'
  | 'reconnecting'
  | 'error'

/** Default end-of-utterance silence for hands-free (2–3s pause tolerance). */
export const DEFAULT_HANDS_FREE_SILENCE_MS = 2500

/** Hard floor / ceiling for configurable silence timeout. */
export const MIN_HANDS_FREE_SILENCE_MS = 1500
export const MAX_HANDS_FREE_SILENCE_MS = 5000

export interface VoiceLocaleConfig {
  locale: VoiceLocale
  speechLang: string
  labelAr: string
  labelEn: string
}

export const VOICE_LOCALES: Record<VoiceLocale, VoiceLocaleConfig> = {
  ar: { locale: 'ar', speechLang: 'ar-SA', labelAr: 'العربية', labelEn: 'Arabic' },
  en: { locale: 'en', speechLang: 'en-US', labelAr: 'الإنجليزية', labelEn: 'English' },
}

export interface SpeechRecognitionResultEvent {
  transcript: string
  isFinal: boolean
}

export interface SpeechToTextStartOptions {
  locale: VoiceLocale
  continuous: boolean
  interimResults: boolean
}

export interface SpeechToTextProvider {
  readonly providerId: string
  isSupported(): boolean
  start(options: SpeechToTextStartOptions): Promise<void>
  stop(): Promise<string>
  abort(): void
  onPartial?: (event: SpeechRecognitionResultEvent) => void
  onFinal?: (event: SpeechRecognitionResultEvent) => void
  onError?: (error: string) => void
  onEnd?: () => void
}

export interface TextToSpeechSpeakOptions {
  locale: VoiceLocale
  text: string
  interrupt?: boolean
}

export interface TextToSpeechProvider {
  readonly providerId: string
  isSupported(): boolean
  speak(options: TextToSpeechSpeakOptions): Promise<void>
  stop(): void
  isSpeaking(): boolean
}

export interface MicrophonePermissionState {
  state: 'granted' | 'denied' | 'prompt' | 'unsupported'
  error: string | null
}

export function speechLangForLocale(locale: VoiceLocale): string {
  return VOICE_LOCALES[locale].speechLang
}

export function normalizeVoiceLocale(value: string | null | undefined): VoiceLocale {
  return value === 'en' ? 'en' : 'ar'
}
