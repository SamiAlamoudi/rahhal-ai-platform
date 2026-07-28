/**
 * Voice Experience preferences — TTS voice, Arabic dialect, speed, gender.
 * Persisted per user in localStorage. Never injected into trip memory.
 */

export type ArabicDialectPreference =
  | 'white'
  | 'saudi'
  | 'gulf'
  | 'moroccan'
  | 'fusha'

export type VoiceSpeakingSpeed = 'slow' | 'natural' | 'fast'

export type VoiceGenderPreference = 'female' | 'male' | 'any'

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
  dialect: ArabicDialectPreference
  speed: VoiceSpeakingSpeed
  gender: VoiceGenderPreference
}

export const VOICE_PREFS_STORAGE_KEY = 'rahhal.voiceExperience.v1'

/** Default selected after Arabic voice comparison pack (see artifacts). */
export const DEFAULT_VOICE_ID: OpenAiTtsVoiceId = 'coral'

export const DEFAULT_VOICE_PREFS: VoiceExperiencePrefs = {
  voiceId: DEFAULT_VOICE_ID,
  dialect: 'saudi',
  speed: 'natural',
  gender: 'female',
}

export const ARABIC_DIALECT_OPTIONS: Array<{
  id: ArabicDialectPreference
  labelAr: string
  /** Soft guidance for chat + TTS — never caricature. */
  guidance: string
  /** Whether we claim verified native dialect quality in product copy. */
  verifiedNativeQuality: boolean
}> = [
  {
    id: 'white',
    labelAr: 'العربية البيضاء',
    guidance:
      'Neutral educated Arabic (العربية البيضاء): clear, modern, widely understood. Still warm spoken dialogue — not formal written Arabic. Change wording toward clarity, not regional slang.',
    verifiedNativeQuality: true,
  },
  {
    id: 'saudi',
    labelAr: 'السعودية',
    guidance:
      'Educated Saudi travel-consultant wording: حياك، تمام، خلنا، وين، أبشري، إن شاء الله، على راحتك. Natural rhythm — never exaggerated Najdi caricature, never MSA brochure tone.',
    verifiedNativeQuality: false,
  },
  {
    id: 'gulf',
    labelAr: 'الخليجية',
    guidance:
      'Natural Gulf conversational wording and warm pacing when clear. Prefer soft Gulf rhythm over dialect theatre. If unclear, fall back to natural clear Arabic.',
    verifiedNativeQuality: false,
  },
  {
    id: 'moroccan',
    labelAr: 'المغربية',
    guidance:
      'Light Moroccan coloring only if it stays clear to a broad Arabic audience. If unsure, fall back to clear natural Arabic rather than heavy Darija imitation.',
    verifiedNativeQuality: false,
  },
  {
    id: 'fusha',
    labelAr: 'الفصحى',
    guidance:
      'Use clear Modern Standard Arabic (فصحى معاصرة مبسّطة), still warm and conversational — not classical oratory.',
    verifiedNativeQuality: true,
  },
]

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
  return ARABIC_DIALECT_OPTIONS.some((d) => d.id === value)
}

export function isVoiceSpeakingSpeed(value: string): value is VoiceSpeakingSpeed {
  return SPEAKING_SPEED_OPTIONS.some((s) => s.id === value)
}

export function isVoiceGenderPreference(value: string): value is VoiceGenderPreference {
  return value === 'female' || value === 'male' || value === 'any'
}

export function normalizeVoiceExperiencePrefs(
  raw: Partial<VoiceExperiencePrefs> | null | undefined,
): VoiceExperiencePrefs {
  const base = { ...DEFAULT_VOICE_PREFS }
  if (!raw) return base
  if (raw.voiceId && isOpenAiTtsVoiceId(raw.voiceId)) base.voiceId = raw.voiceId
  if (raw.dialect && isArabicDialectPreference(raw.dialect)) base.dialect = raw.dialect
  if (raw.speed && isVoiceSpeakingSpeed(raw.speed)) base.speed = raw.speed
  if (raw.gender && isVoiceGenderPreference(raw.gender)) base.gender = raw.gender
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
  const opt = ARABIC_DIALECT_OPTIONS.find((d) => d.id === dialect)
  return opt?.guidance
    ?? 'Speak clear natural Arabic. Do not invent travel facts.'
}

/**
 * Stable Rahhal voice persona for TTS instructions.
 * Keep concise — long instructions add latency without quality.
 */
export function buildTtsSpeechInstructions(input: {
  locale: 'ar' | 'en'
  dialect?: ArabicDialectPreference
}): string {
  if (input.locale !== 'ar') {
    return [
      'Speak naturally and conversationally as an experienced travel consultant.',
      'Warm, confident, calm. Avoid announcer-style delivery and exaggerated emotion.',
      'Use natural pauses. Keep volume, tone, and pace consistent.',
      'Do not sound like a navigation system or text reader.',
    ].join(' ')
  }

  const dialect = input.dialect ?? DEFAULT_VOICE_PREFS.dialect
  const dialectLine = dialectChatGuidance(dialect)

  return [
    'Speak naturally and conversationally in Arabic as Rahhal, an experienced travel consultant.',
    'Warm, confident, calm, concise — human live-call tone.',
    'Avoid announcer-style delivery, navigation-system tone, and exaggerated emotion.',
    'Use natural pauses. Keep volume, tone, and pace consistent throughout.',
    'Do not sound like a text reader.',
    dialectLine,
    'If a strong regional accent would sound unnatural, use clear natural Arabic instead of a poor imitation.',
    'Never insert English words.',
  ].join(' ')
}
