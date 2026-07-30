/**
 * Voice Experience preferences — voice, dialect, speed, gender, energy.
 * Persisted per user in localStorage. Never injected into trip memory.
 */

import {
  ARABIC_DIALECT_CATALOG,
  dialectGuidance,
  isArabicDialectId,
  type ArabicDialectId,
} from './arabicDialectAdaptation'
import {
  CONVERSATION_LANGUAGES,
  isConversationLanguageCode,
  type ConversationLanguageCode,
} from './conversationLanguageLayer'

/** Prefers auto-adapt; MSA when dialect unknown. */
export type ArabicDialectPreference = ArabicDialectId

export type VoiceSpeakingSpeed = 'slow' | 'natural' | 'fast'

export type VoiceGenderPreference = 'female' | 'male' | 'any'

/** Speaking energy preference for Realtime prosody cues. */
export type VoiceEnergyPreference = 'calm' | 'natural' | 'lively'

export type ConversationLanguagePreference = ConversationLanguageCode

/** Official OpenAI gpt-4o-mini-tts voices suitable for Arabic consultant speech. */
export type OpenAiTtsVoiceId =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'cedar'
  | 'coral'
  | 'echo'
  | 'fable'
  | 'marin'
  | 'nova'
  | 'onyx'
  | 'sage'
  | 'shimmer'
  | 'verse'

export interface VoiceExperiencePrefs {
  voiceId: OpenAiTtsVoiceId
  /** Preferred conversation language (auto = detect / follow traveler). Not trip memory. */
  language: ConversationLanguagePreference
  /** Fallback when a requested language is not optimized. */
  languageFallback: 'en' | 'ar'
  dialect: ArabicDialectPreference
  speed: VoiceSpeakingSpeed
  gender: VoiceGenderPreference
  energy: VoiceEnergyPreference
}

export const VOICE_PREFS_STORAGE_KEY = 'rahhal.voiceExperience.v1'

/** Default selected after Arabic voice comparison pack (see artifacts). */
export const DEFAULT_VOICE_ID: OpenAiTtsVoiceId = 'coral'

export const DEFAULT_VOICE_PREFS: VoiceExperiencePrefs = {
  voiceId: DEFAULT_VOICE_ID,
  language: 'auto',
  /** Arabic-first product: prefer Arabic when detection is uncertain. */
  languageFallback: 'ar',
  /** Adapt to traveler speech; unknown → conversational MSA. */
  dialect: 'auto',
  speed: 'natural',
  gender: 'female',
  energy: 'natural',
}

export const CONVERSATION_LANGUAGE_OPTIONS = CONVERSATION_LANGUAGES.map((l) => ({
  id: l.id,
  labelAr: l.labelNative,
  labelEn: l.labelEn,
  phase: l.phase,
  productionReady: l.productionReady,
}))

export const ARABIC_DIALECT_OPTIONS: Array<{
  id: ArabicDialectPreference
  labelAr: string
  /** Soft guidance for chat + TTS — never caricature. */
  guidance: string
  /** Whether we claim verified native dialect quality in product copy. */
  verifiedNativeQuality: boolean
}> = ARABIC_DIALECT_CATALOG.map((d) => ({
  id: d.id,
  labelAr: d.labelAr,
  guidance: d.guidance,
  // MSA / white are widely safe; regional dialects are soft adaptation guidance.
  verifiedNativeQuality: d.id === 'fusha' || d.id === 'white',
}))

export const OPENAI_TTS_VOICES: Array<{
  id: OpenAiTtsVoiceId
  labelAr: string
  gender: 'female' | 'male'
  arabicEvalCandidate: boolean
}> = [
  { id: 'marin', labelAr: 'مارين', gender: 'female', arabicEvalCandidate: true },
  { id: 'coral', labelAr: 'كورال', gender: 'female', arabicEvalCandidate: true },
  { id: 'nova', labelAr: 'نوفا', gender: 'female', arabicEvalCandidate: true },
  { id: 'sage', labelAr: 'سايج', gender: 'female', arabicEvalCandidate: true },
  { id: 'shimmer', labelAr: 'شيمر', gender: 'female', arabicEvalCandidate: false },
  { id: 'alloy', labelAr: 'ألوي', gender: 'female', arabicEvalCandidate: false },
  { id: 'verse', labelAr: 'فيرس', gender: 'female', arabicEvalCandidate: false },
  { id: 'ballad', labelAr: 'بالاد', gender: 'female', arabicEvalCandidate: false },
  { id: 'onyx', labelAr: 'أونيكس', gender: 'male', arabicEvalCandidate: true },
  { id: 'ash', labelAr: 'آش', gender: 'male', arabicEvalCandidate: false },
  { id: 'echo', labelAr: 'إيكو', gender: 'male', arabicEvalCandidate: false },
  { id: 'cedar', labelAr: 'سيدار', gender: 'male', arabicEvalCandidate: false },
  { id: 'fable', labelAr: 'فيبل', gender: 'male', arabicEvalCandidate: false },
]

export const SPEAKING_SPEED_OPTIONS: Array<{
  id: VoiceSpeakingSpeed
  labelAr: string
  /** OpenAI speech speed multiplier. */
  rate: number
}> = [
  { id: 'slow', labelAr: 'بطيء', rate: 0.9 },
  { id: 'natural', labelAr: 'طبيعي', rate: 1.0 },
  { id: 'fast', labelAr: 'سريع', rate: 1.12 },
]

export const VOICE_ENERGY_OPTIONS: Array<{
  id: VoiceEnergyPreference
  labelAr: string
}> = [
  { id: 'calm', labelAr: 'هادئ' },
  { id: 'natural', labelAr: 'طبيعي' },
  { id: 'lively', labelAr: 'حيوي' },
]

export function dialectLabel(id: ArabicDialectPreference): string {
  return ARABIC_DIALECT_OPTIONS.find((d) => d.id === id)?.labelAr ?? id
}

export function speakingSpeedRate(speed: VoiceSpeakingSpeed): number {
  return SPEAKING_SPEED_OPTIONS.find((s) => s.id === speed)?.rate ?? 1
}

export function isOpenAiTtsVoiceId(value: string): value is OpenAiTtsVoiceId {
  return OPENAI_TTS_VOICES.some((v) => v.id === value)
}

export function isArabicDialectPreference(value: string): value is ArabicDialectPreference {
  return isArabicDialectId(value)
}

export function isVoiceSpeakingSpeed(value: string): value is VoiceSpeakingSpeed {
  return SPEAKING_SPEED_OPTIONS.some((s) => s.id === value)
}

export function isVoiceGenderPreference(value: string): value is VoiceGenderPreference {
  return value === 'female' || value === 'male' || value === 'any'
}

export function isVoiceEnergyPreference(value: string): value is VoiceEnergyPreference {
  return value === 'calm' || value === 'natural' || value === 'lively'
}

export function isConversationLanguagePreference(
  value: string,
): value is ConversationLanguagePreference {
  return isConversationLanguageCode(value)
}

export function normalizeVoiceExperiencePrefs(
  raw: Partial<VoiceExperiencePrefs> | null | undefined,
): VoiceExperiencePrefs {
  const base = { ...DEFAULT_VOICE_PREFS }
  if (!raw) return base
  if (raw.voiceId && isOpenAiTtsVoiceId(raw.voiceId)) base.voiceId = raw.voiceId
  if (raw.language && isConversationLanguagePreference(raw.language)) base.language = raw.language
  if (raw.languageFallback === 'ar' || raw.languageFallback === 'en') {
    base.languageFallback = raw.languageFallback
  }
  if (raw.dialect && isArabicDialectPreference(raw.dialect)) base.dialect = raw.dialect
  if (raw.speed && isVoiceSpeakingSpeed(raw.speed)) base.speed = raw.speed
  if (raw.gender && isVoiceGenderPreference(raw.gender)) base.gender = raw.gender
  if (raw.energy && isVoiceEnergyPreference(raw.energy)) base.energy = raw.energy
  // Align voice with gender preference when mismatched.
  const voiceMeta = OPENAI_TTS_VOICES.find((v) => v.id === base.voiceId)
  if (base.gender !== 'any' && voiceMeta && voiceMeta.gender !== base.gender) {
    const fallback = OPENAI_TTS_VOICES.find(
      (v) => v.gender === base.gender && v.arabicEvalCandidate,
    ) ?? OPENAI_TTS_VOICES.find((v) => v.gender === base.gender)
    if (fallback) base.voiceId = fallback.id
  }
  return base
}

function storageKeyForUser(userId?: string | null): string {
  const id = (userId || 'anonymous').trim() || 'anonymous'
  return `${VOICE_PREFS_STORAGE_KEY}:${id}`
}

export function loadVoiceExperiencePrefs(userId?: string | null): VoiceExperiencePrefs {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_VOICE_PREFS }
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId))
    if (!raw) return { ...DEFAULT_VOICE_PREFS }
    return normalizeVoiceExperiencePrefs(JSON.parse(raw) as Partial<VoiceExperiencePrefs>)
  } catch {
    return { ...DEFAULT_VOICE_PREFS }
  }
}

export function saveVoiceExperiencePrefs(
  prefs: Partial<VoiceExperiencePrefs>,
  userId?: string | null,
): VoiceExperiencePrefs {
  const next = normalizeVoiceExperiencePrefs({
    ...loadVoiceExperiencePrefs(userId),
    ...prefs,
  })
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(storageKeyForUser(userId), JSON.stringify(next))
    } catch {
      // ignore quota
    }
  }
  return next
}

/** Soft dialect hint for the chat model — never invents travel facts. */
export function dialectChatGuidance(dialect: ArabicDialectPreference): string {
  return dialectGuidance(dialect)
}

/**
 * Stable Rahhal voice persona for TTS instructions.
 * Keep concise — long instructions add latency without quality.
 */
export function buildTtsSpeechInstructions(input: {
  locale: 'ar' | 'en'
  dialect?: ArabicDialectPreference
  energy?: VoiceEnergyPreference
  speed?: VoiceSpeakingSpeed
}): string {
  if (input.locale !== 'ar') {
    return [
      'Speak naturally and conversationally as an experienced travel consultant.',
      'Warm, confident, calm. Avoid announcer-style delivery and exaggerated emotion.',
      'Use natural pauses. Vary cadence slightly — never identical robotic rhythm.',
      'Do not sound like a navigation system or text reader.',
    ].join(' ')
  }

  const dialect = input.dialect ?? DEFAULT_VOICE_PREFS.dialect
  const dialectLine = dialectChatGuidance(dialect)
  const energy =
    input.energy === 'calm'
      ? 'Calm grounded energy.'
      : input.energy === 'lively'
        ? 'Lively engaged energy without shouting.'
        : 'Natural mid-range energy.'
  const pace =
    input.speed === 'slow'
      ? 'Slightly slower pace.'
      : input.speed === 'fast'
        ? 'Slightly quicker pace, still clear.'
        : 'Natural conversational pace.'

  return [
    'Speak naturally and conversationally in Arabic as Rahhal, an experienced travel consultant.',
    'Warm, confident, concise — human live-call tone.',
    'Avoid announcer-style delivery, navigation-system tone, and exaggerated emotion.',
    'Use natural pauses. Vary pitch and stress — never identical cadence.',
    energy,
    pace,
    'Do not sound like a text reader.',
    dialectLine,
    'If a strong regional accent would sound unnatural, use clear natural Arabic instead of a poor imitation.',
    'Never insert English words.',
  ].join(' ')
}
