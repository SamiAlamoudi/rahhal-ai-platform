/**
 * Voice Conversation types — input surface over the shared chatEngine.
 * No separate conversation/message store. Phone/video calling are out of scope.
 *
 * Recovery Phase 2.3 — authoritative continuous Voice Session states.
 */

export type VoiceLocale = 'ar' | 'en'
export type VoiceInputMode = 'push_to_talk' | 'hands_free'

/**
 * Authoritative voice session state machine:
 * IDLE → LISTENING → PROCESSING → SPEAKING (real TTS only) | READY → LISTENING
 * Explicit stop / inactivity → ENDED
 */
export type VoiceSessionStatus =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'thinking'
  | 'responding'
  | 'processing' // alias of thinking for UI/tests
  | 'speaking'
  | 'ready'
  | 'ended'
  | 'reconnecting'
  | 'error'

/** UX labels — exactly one active state at a time (Arabic UI). */
export const VOICE_UX_LABELS_AR: Record<VoiceSessionStatus, string> = {
  idle: 'جاهز',
  requesting_permission: 'طلب إذن الميكروفون…',
  listening: 'يستمع إليك',
  thinking: 'يفكر',
  responding: 'يفكر',
  processing: 'يفكر',
  speaking: 'يتحدث',
  ready: 'جاهز',
  ended: 'انتهت الجلسة',
  reconnecting: 'يستمع إليك',
  error: 'حدث خطأ',
}

/** Hands-free: after speech ends, auto-send without an extra Send tap. */
export const DEFAULT_HANDS_FREE_SILENCE_MS = 2200

/** Hard floor / ceiling for configurable silence timeout. */
export const MIN_HANDS_FREE_SILENCE_MS = 2000
export const MAX_HANDS_FREE_SILENCE_MS = 6000

/** End continuous session after this much idle listening with no speech. */
export const DEFAULT_VOICE_INACTIVITY_MS = 45_000

/** Brief READY hold before auto-returning to LISTENING. */
export const DEFAULT_READY_HOLD_MS = 450

/** Arabic-first STT tags — never start Arabic UI on en-US. */
export const DEFAULT_ARABIC_SPEECH_LANG = 'ar-SA'
export const FALLBACK_ARABIC_SPEECH_LANG = 'ar'

export interface VoiceLocaleConfig {
  locale: VoiceLocale
  speechLang: string
  labelAr: string
  labelEn: string
}

export const VOICE_LOCALES: Record<VoiceLocale, VoiceLocaleConfig> = {
  ar: { locale: 'ar', speechLang: DEFAULT_ARABIC_SPEECH_LANG, labelAr: 'العربية', labelEn: 'Arabic' },
  en: { locale: 'en', speechLang: 'en-US', labelAr: 'الإنجليزية', labelEn: 'English' },
}

export interface SpeechRecognitionResultEvent {
  transcript: string
  isFinal: boolean
  /** Web Speech API confidence 0–1 when the browser provides it. */
  confidence?: number
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

/** Ordered STT language tags to try for a locale (Arabic: ar-SA → ar). */
export function speechLangFallbacksForLocale(locale: VoiceLocale): string[] {
  if (locale === 'en') return ['en-US', 'en']
  return [DEFAULT_ARABIC_SPEECH_LANG, FALLBACK_ARABIC_SPEECH_LANG]
}

export function normalizeVoiceLocale(value: string | null | undefined): VoiceLocale {
  return value === 'en' ? 'en' : 'ar'
}

/** True when TTS can genuinely play audio (not mock / unsupported). */
export function isRealTtsProvider(tts: TextToSpeechProvider): boolean {
  return tts.isSupported() && tts.providerId !== 'mock-tts'
}
