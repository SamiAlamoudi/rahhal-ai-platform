/**
 * Voice Conversation types — input surface over the shared chatEngine.
 * No separate conversation/message store. Phone/video calling are out of scope.
 */

export type VoiceLocale =
  | 'ar'
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'it'
  | 'tr'
  | 'pt'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'hi'
  | 'ur'
  | 'id'

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

/** Default end-of-utterance silence for hands-free (think-pause tolerance). */
export const DEFAULT_HANDS_FREE_SILENCE_MS = 2500

/** Hard floor / ceiling for configurable silence timeout. */
export const MIN_HANDS_FREE_SILENCE_MS = 2000
export const MAX_HANDS_FREE_SILENCE_MS = 6000

export interface VoiceLocaleConfig {
  locale: VoiceLocale
  speechLang: string
  labelAr: string
  labelEn: string
}

export const VOICE_LOCALES: Record<VoiceLocale, VoiceLocaleConfig> = {
  ar: { locale: 'ar', speechLang: 'ar-SA', labelAr: 'العربية', labelEn: 'Arabic' },
  en: { locale: 'en', speechLang: 'en-US', labelAr: 'الإنجليزية', labelEn: 'English' },
  fr: { locale: 'fr', speechLang: 'fr-FR', labelAr: 'الفرنسية', labelEn: 'French' },
  es: { locale: 'es', speechLang: 'es-ES', labelAr: 'الإسبانية', labelEn: 'Spanish' },
  de: { locale: 'de', speechLang: 'de-DE', labelAr: 'الألمانية', labelEn: 'German' },
  it: { locale: 'it', speechLang: 'it-IT', labelAr: 'الإيطالية', labelEn: 'Italian' },
  tr: { locale: 'tr', speechLang: 'tr-TR', labelAr: 'التركية', labelEn: 'Turkish' },
  pt: { locale: 'pt', speechLang: 'pt-BR', labelAr: 'البرتغالية', labelEn: 'Portuguese' },
  ru: { locale: 'ru', speechLang: 'ru-RU', labelAr: 'الروسية', labelEn: 'Russian' },
  zh: { locale: 'zh', speechLang: 'zh-CN', labelAr: 'الصينية', labelEn: 'Chinese' },
  ja: { locale: 'ja', speechLang: 'ja-JP', labelAr: 'اليابانية', labelEn: 'Japanese' },
  ko: { locale: 'ko', speechLang: 'ko-KR', labelAr: 'الكورية', labelEn: 'Korean' },
  hi: { locale: 'hi', speechLang: 'hi-IN', labelAr: 'الهندية', labelEn: 'Hindi' },
  ur: { locale: 'ur', speechLang: 'ur-PK', labelAr: 'الأردية', labelEn: 'Urdu' },
  id: { locale: 'id', speechLang: 'id-ID', labelAr: 'الإندونيسية', labelEn: 'Indonesian' },
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
  /** Official OpenAI voice id (coral, marin, …). */
  voice?: string
  /** OpenAI speech speed 0.25–4.0. */
  speed?: number
  /** Arabic dialect preference id (saudi, gulf, …). */
  dialect?: string
  /** Optional TTS style instructions override. */
  instructions?: string
  /** Preferred audio container (wav recommended for lower start latency). */
  format?: 'mp3' | 'wav' | 'opus' | 'aac' | 'flac' | 'pcm'
  /** Optional latency callbacks for one-shot synthesis. */
  onTtsRequestStart?: () => void
  onTtsResponseComplete?: () => void
  onAudioDecodeComplete?: () => void
  onAudioPlaybackStart?: () => void
  /** Fired when this turn's object URL is assigned to the persistent element. */
  onObjectUrlAssigned?: () => void
}

export interface TextToSpeechProvider {
  readonly providerId: string
  isSupported(): boolean
  speak(options: TextToSpeechSpeakOptions): Promise<void>
  stop(): void
  isSpeaking(): boolean
  /** Optional: start synthesizing ahead of play for ChatGPT-like overlap. */
  prefetch?(options: Pick<TextToSpeechSpeakOptions, 'locale' | 'text' | 'voice' | 'speed' | 'dialect' | 'instructions' | 'format'>): void
}

export interface MicrophonePermissionState {
  state: 'granted' | 'denied' | 'prompt' | 'unsupported'
  error: string | null
}

export function speechLangForLocale(locale: VoiceLocale): string {
  return VOICE_LOCALES[locale]?.speechLang || 'en-US'
}

export function normalizeVoiceLocale(value: string | null | undefined): VoiceLocale {
  if (value && value in VOICE_LOCALES) return value as VoiceLocale
  return 'ar'
}
