/**
 * Multilingual conversation language layer (Realtime language adaptation only).
 * Does NOT change WebRTC / Realtime architecture.
 *
 * - Auto-detect spoken language
 * - Mid-conversation switch while preserving trip context (facts live in trip memory)
 * - Natural spoken style per language
 * - Fallback when a language is unsupported / not production-ready
 */

export type ConversationLanguageCode =
  | 'auto'
  | 'ar'
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'it'
  | 'tr'
  // Phase 2 readiness
  | 'pt'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'hi'
  | 'ur'
  | 'id'

export type LanguagePhase = 1 | 2

export type ConversationLanguageMeta = {
  id: ConversationLanguageCode
  labelEn: string
  labelNative: string
  phase: LanguagePhase | 0
  /** Soft spoken-style guidance — never literal Arabic translation. */
  spokenStyle: string
  /**
   * Product claim: only true after real-device audio verification.
   * Until then, treat as candidate — may fall back politely.
   */
  productionReady: boolean
}

export const CONVERSATION_LANGUAGES: ConversationLanguageMeta[] = [
  {
    id: 'auto',
    labelEn: 'Auto-detect',
    labelNative: 'تلقائي / Auto',
    phase: 0,
    spokenStyle: 'Detect the traveler language each turn and speak in that language naturally.',
    productionReady: true,
  },
  {
    id: 'ar',
    labelEn: 'Arabic',
    labelNative: 'العربية',
    phase: 1,
    spokenStyle:
      'Natural spoken Arabic. Use dialect adaptation when available; otherwise conversational MSA. Never formal brochure Arabic.',
    productionReady: false,
  },
  {
    id: 'en',
    labelEn: 'English',
    labelNative: 'English',
    phase: 1,
    spokenStyle:
      'Natural conversational English — warm premium travel consultant. Short spoken sentences. Not corporate support script.',
    productionReady: false,
  },
  {
    id: 'fr',
    labelEn: 'French',
    labelNative: 'Français',
    phase: 1,
    spokenStyle:
      'Français parlé naturel, chaleureux et précis. Pas de français administratif. Phrases courtes.',
    productionReady: false,
  },
  {
    id: 'es',
    labelEn: 'Spanish',
    labelNative: 'Español',
    phase: 1,
    spokenStyle:
      'Español conversacional natural, claro y cercano. Evita tono burocrático. Frases cortas.',
    productionReady: false,
  },
  {
    id: 'de',
    labelEn: 'German',
    labelNative: 'Deutsch',
    phase: 1,
    spokenStyle:
      'Natürliches gesprochenes Deutsch — klar, freundlich, präzise. Kein Behördendeutsch. Kurze Sätze.',
    productionReady: false,
  },
  {
    id: 'it',
    labelEn: 'Italian',
    labelNative: 'Italiano',
    phase: 1,
    spokenStyle:
      'Italiano parlato naturale, caldo e chiaro. Non burocratico. Frasi brevi.',
    productionReady: false,
  },
  {
    id: 'tr',
    labelEn: 'Turkish',
    labelNative: 'Türkçe',
    phase: 1,
    spokenStyle:
      'Doğal konuşma Türkçesi — sıcak, net, kısa cümleler. Resmi yazı dili kullanma.',
    productionReady: false,
  },
  // Phase 2 — readiness only
  { id: 'pt', labelEn: 'Portuguese', labelNative: 'Português', phase: 2, spokenStyle: 'Português falado natural e claro.', productionReady: false },
  { id: 'ru', labelEn: 'Russian', labelNative: 'Русский', phase: 2, spokenStyle: 'Естественный разговорный русский.', productionReady: false },
  { id: 'zh', labelEn: 'Chinese', labelNative: '中文', phase: 2, spokenStyle: '自然口语中文，简洁清晰。', productionReady: false },
  { id: 'ja', labelEn: 'Japanese', labelNative: '日本語', phase: 2, spokenStyle: '自然な話し言葉の日本語。', productionReady: false },
  { id: 'ko', labelEn: 'Korean', labelNative: '한국어', phase: 2, spokenStyle: '자연스러운 구어체 한국어.', productionReady: false },
  { id: 'hi', labelEn: 'Hindi', labelNative: 'हिन्दी', phase: 2, spokenStyle: 'प्राकृतिक बोलचाल की हिंदी।', productionReady: false },
  { id: 'ur', labelEn: 'Urdu', labelNative: 'اردو', phase: 2, spokenStyle: 'قدرتی بول چال کی اردو۔', productionReady: false },
  { id: 'id', labelEn: 'Indonesian', labelNative: 'Bahasa Indonesia', phase: 2, spokenStyle: 'Bahasa Indonesia lisan yang alami.', productionReady: false },
]

export const PHASE1_LANGUAGE_CODES = CONVERSATION_LANGUAGES
  .filter((l) => l.phase === 1)
  .map((l) => l.id) as Array<Exclude<ConversationLanguageCode, 'auto'>>

export function isConversationLanguageCode(value: string): value is ConversationLanguageCode {
  return CONVERSATION_LANGUAGES.some((l) => l.id === value)
}

export function languageMeta(id: ConversationLanguageCode): ConversationLanguageMeta {
  return CONVERSATION_LANGUAGES.find((l) => l.id === id)
    ?? CONVERSATION_LANGUAGES.find((l) => l.id === 'en')!
}

export type LanguageResolution = {
  language: Exclude<ConversationLanguageCode, 'auto'>
  source: 'preference' | 'explicit_switch' | 'detected' | 'fallback'
  switched: boolean
  /** True when we must avoid claiming native quality / may announce soft fallback. */
  notFullyOptimized: boolean
  fallbackTo: 'en' | 'ar' | null
}

/** Explicit mid-conversation switch requests. */
const EXPLICIT_SWITCH: Array<{ language: Exclude<ConversationLanguageCode, 'auto'>; re: RegExp }> = [
  { language: 'en', re: /(?:let'?s\s+)?(?:continue|speak|talk|switch)\s+(?:in\s+)?english|بالإنجليزي|بالانجليزي|تكلم إنجليزي|speak english/i },
  { language: 'ar', re: /(?:let'?s\s+)?(?:continue|speak|talk|switch)\s+(?:in\s+)?arabic|بالعربي|بالعربية|تكلم عربي|speak arabic/i },
  { language: 'fr', re: /(?:continue|parlons|parle|switch).{0,20}fran[cç]ais|en français|بالفرنسي|speak french/i },
  { language: 'es', re: /(?:contin[uú]a|hablemos|habla|switch).{0,20}espa[nñ]ol|en español|بالإسباني|speak spanish/i },
  { language: 'de', re: /(?:weiter|sprich|sprechen|switch).{0,20}deutsch|auf deutsch|بالألماني|speak german/i },
  { language: 'it', re: /(?:continua|parliamo|parla|switch).{0,20}italiano|in italiano|بالإيطالي|speak italian/i },
  { language: 'tr', re: /(?:devam|konu[sş]|switch).{0,20}t[uü]rk[cç]e|t[uü]rk[cç]e konuş|بالتركي|speak turkish/i },
  { language: 'pt', re: /(?:continuar|fale|switch).{0,20}portugu[eê]s|em português|speak portuguese/i },
  { language: 'ru', re: /(?:продолж|говор|switch).{0,20}русск|на русском|speak russian/i },
  { language: 'zh', re: /(?:说|用).{0,6}中文|speak chinese|in chinese/i },
  { language: 'ja', re: /日本語で|speak japanese|in japanese/i },
  { language: 'ko', re: /한국어로|speak korean|in korean/i },
  { language: 'hi', re: /हिंदी में|speak hindi|in hindi/i },
  { language: 'ur', re: /اردو میں|speak urdu|in urdu/i },
  { language: 'id', re: /dalam bahasa indonesia|speak indonesian|in indonesian/i },
]

function scriptScores(text: string): Partial<Record<Exclude<ConversationLanguageCode, 'auto'>, number>> {
  const t = text || ''
  const scores: Partial<Record<Exclude<ConversationLanguageCode, 'auto'>, number>> = {}
  const arabic = (t.match(/[\u0600-\u06FF]/g) || []).length
  const latin = (t.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length
  const cyrillic = (t.match(/[\u0400-\u04FF]/g) || []).length
  const devanagari = (t.match(/[\u0900-\u097F]/g) || []).length

  if (arabic > 2) {
    // Urdu shares Arabic script — light Urdu markers
    if (/ہیں|ہے|آپ|میں/.test(t)) scores.ur = (scores.ur || 0) + 0.7
    else scores.ar = (scores.ar || 0) + 0.8
  }
  if (cyrillic > 2) scores.ru = (scores.ru || 0) + 0.8
  if (devanagari > 2) scores.hi = (scores.hi || 0) + 0.8
  if (/[\u3040-\u30ff]/.test(t)) scores.ja = (scores.ja || 0) + 0.85
  if (/[\uac00-\ud7af]/.test(t)) scores.ko = (scores.ko || 0) + 0.85
  if (/[\u4e00-\u9fff]/.test(t) && !scores.ja && !scores.ko) scores.zh = (scores.zh || 0) + 0.75

  if (latin > 3) {
    const lower = t.toLowerCase()
    if (/\b(hello|hi|the|and|flight|hotel|please|want|looking|thanks)\b/.test(lower)) {
      scores.en = (scores.en || 0) + 0.55
    }
    if (/\b(je|vous|voyage|h[oô]tel|vol|bonjour|merci|salut)\b/.test(lower)) {
      scores.fr = (scores.fr || 0) + 0.6
    }
    if (/\b(quiero|viaje|hotel|vuelo|hola|gracias|d[oó]nde|buenas)\b/.test(lower)) {
      scores.es = (scores.es || 0) + 0.6
    }
    if (/\b(ich|flug|hotel|reise|bitte|danke|wohin|hallo|guten)\b/.test(lower)) {
      scores.de = (scores.de || 0) + 0.6
    }
    if (/\b(voglio|viaggio|albergo|volo|ciao|grazie|dove|buongiorno)\b/.test(lower)) {
      scores.it = (scores.it || 0) + 0.6
    }
    if (/(?:^|[^\p{L}])(?:ben|uçuş|ucus|otel|tatil|merhaba|teşekkür|tesekkur|nereye|günaydın|gunaydin|istiyorum)(?=$|[^\p{L}])/iu.test(t)) {
      scores.tr = (scores.tr || 0) + 0.65
    }
    if (/\b(quero|viagem|hotel|voo|ol[aá]|obrigad[oa])\b/.test(lower)) {
      scores.pt = (scores.pt || 0) + 0.55
    }
    if (/\b(saya|penerbangan|hotel|terima kasih)\b/.test(lower)) {
      scores.id = (scores.id || 0) + 0.55
    }
    // Generic latin fallback weight toward English if nothing else
    if (!scores.en && !scores.fr && !scores.es && !scores.de && !scores.it && !scores.tr && !scores.pt && !scores.id) {
      scores.en = 0.35
    }
  }

  return scores
}

export function detectConversationLanguage(text: string): {
  language: Exclude<ConversationLanguageCode, 'auto'>
  confidence: number
} {
  const t = (text || '').trim()
  if (!t) return { language: 'en', confidence: 0 }

  for (const sw of EXPLICIT_SWITCH) {
    if (sw.re.test(t)) return { language: sw.language, confidence: 1 }
  }

  const scores = scriptScores(t)
  let best: Exclude<ConversationLanguageCode, 'auto'> = 'en'
  let bestScore = 0
  for (const [lang, score] of Object.entries(scores) as Array<[Exclude<ConversationLanguageCode, 'auto'>, number]>) {
    if (score > bestScore) {
      best = lang
      bestScore = score
    }
  }
  if (bestScore < 0.4) {
    // Prefer Arabic script → ar, else en
    if (/[\u0600-\u06FF]/.test(t)) return { language: 'ar', confidence: 0.35 }
    return { language: 'en', confidence: bestScore }
  }
  return { language: best, confidence: Math.min(1, bestScore) }
}

export function detectExplicitLanguageSwitch(
  text: string,
): Exclude<ConversationLanguageCode, 'auto'> | null {
  const t = (text || '').trim()
  if (!t) return null
  for (const sw of EXPLICIT_SWITCH) {
    if (sw.re.test(t)) return sw.language
  }
  return null
}

/**
 * Resolve language for this turn.
 * Preference (non-auto) locks language unless an explicit switch is requested.
 * Auto: explicit switch > detection > previous > en.
 */
export function resolveConversationLanguage(input: {
  preference?: ConversationLanguageCode | string | null
  utterance?: string
  previousLanguage?: Exclude<ConversationLanguageCode, 'auto'> | null
  /** User fallback preference when a language is not optimized. */
  fallbackPreference?: 'en' | 'ar'
}): LanguageResolution {
  const utterance = input.utterance || ''
  const explicit = detectExplicitLanguageSwitch(utterance)
  const pref = (input.preference || 'auto') as string
  const fallbackPref = input.fallbackPreference === 'en' ? 'en' : 'ar'

  let language: Exclude<ConversationLanguageCode, 'auto'>
  let source: LanguageResolution['source']
  let switched = false

  if (explicit) {
    language = explicit
    source = 'explicit_switch'
    switched = Boolean(input.previousLanguage && input.previousLanguage !== explicit)
  } else if (pref !== 'auto' && isConversationLanguageCode(pref) && pref !== 'auto') {
    language = pref
    source = 'preference'
  } else {
    const detected = detectConversationLanguage(utterance)
    if (detected.confidence >= 0.4) {
      language = detected.language
      source = 'detected'
      switched = Boolean(input.previousLanguage && input.previousLanguage !== language)
    } else if (input.previousLanguage) {
      language = input.previousLanguage
      source = 'detected'
    } else {
      language = fallbackPref
      source = 'fallback'
    }
  }

  const meta = languageMeta(language)
  const phaseOk = meta.phase === 1 || language === 'ar' || language === 'en'
  // Phase 2 or unverified: allow speaking but flag notFullyOptimized.
  // For phase 2 with very low readiness, fall back politely.
  if (meta.phase === 2) {
    return {
      language: fallbackPref,
      source: 'fallback',
      switched: Boolean(input.previousLanguage && input.previousLanguage !== fallbackPref) || source === 'explicit_switch',
      notFullyOptimized: true,
      fallbackTo: fallbackPref,
    }
  }

  return {
    language,
    source,
    switched,
    notFullyOptimized: !meta.productionReady && !phaseOk ? true : !meta.productionReady,
    fallbackTo: null,
  }
}

const TRAVEL_TERMINOLOGY_RULES = [
  'Never mistranslate proper names: airports, cities, airlines, hotels, passenger names, booking references.',
  'Keep cabin classes, currencies, ISO dates, and booking codes in their standard forms (e.g. Business, EUR, PNR).',
  'You may localize surrounding spoken words, but leave official names intact.',
]

/** Instruction block injected into Realtime session (language layer only). */
export function buildMultilingualInstructions(input: {
  preference?: ConversationLanguageCode | string | null
  utterance?: string
  previousLanguage?: Exclude<ConversationLanguageCode, 'auto'> | null
  fallbackPreference?: 'en' | 'ar'
}): { instructions: string; resolution: LanguageResolution } {
  const resolution = resolveConversationLanguage(input)
  const meta = languageMeta(resolution.language)
  const lines = [
    'MULTILINGUAL CONVERSATION (language layer only — do not change tools or trip facts)',
    `- Speak this entire assistant turn in: ${meta.labelEn} (${resolution.language}), source=${resolution.source}.`,
    meta.spokenStyle,
    'LANGUAGE LOCK (mandatory):',
    `- Lock ${meta.labelEn} for the FULL assistant reply — never switch mid-sentence or mid-turn.`,
    '- Destination names, hotel names, airline names, and other proper nouns may stay in their original form — surrounding speech MUST stay in the locked language.',
    '- Do NOT switch to English (or any other language) merely because a place name is Latin-script.',
    '- NEVER translate the traveler\'s speech. Transcribe and understand it in the original spoken language.',
    '- Only switch languages when the traveler EXPLICITLY requests it (e.g. "تكلم معي بالإنجليزي", "Let\'s continue in English").',
    '- Automatic detection: follow the traveler\'s latest stable utterance language; honor explicit switches immediately.',
    '- Mid-conversation explicit switch: change language on the NEXT assistant turn WITHOUT losing destination, dates, travelers, budget, preferences, or search state.',
    '- Trip facts live in memory — language change must not invent, drop, or rewrite them.',
    '- Native conversational style: do NOT translate Arabic wording literally into other languages.',
    '- Avoid formal written register unless the traveler asks. Do not mix languages unnecessarily.',
    ...TRAVEL_TERMINOLOGY_RULES.map((r) => `- ${r}`),
  ]

  if (resolution.switched) {
    lines.push('- Language just switched: acknowledge briefly in the NEW language, then continue the plan — do not restart the whole conversation.')
  }

  if (resolution.fallbackTo) {
    lines.push(
      `- The requested language is not fully optimized yet. Speak clear ${resolution.fallbackTo === 'ar' ? 'Modern Standard Arabic' : 'English'}.`,
      '- Politely tell the traveler once that that voice language is not fully optimized yet — never silently produce a poor imitation.',
    )
  } else if (resolution.notFullyOptimized) {
    lines.push(
      '- Do not claim native-quality pronunciation for this language until verified with real audio samples.',
      '- Keep clarity first; if quality would degrade, stay clear rather than imitating an accent poorly.',
    )
  }

  return { instructions: lines.join('\n'), resolution }
}

/** Scenario checklist ids for Phase 1 QA (not auto-pass production readiness). */
export const PHASE1_LANGUAGE_SCENARIOS = [
  'greeting',
  'flight_search',
  'hotel_request',
  'car_rental',
  'date_confirmation',
  'currency_price_reading',
  'interruption',
  'second_turn',
  'mid_conversation_switch',
] as const
