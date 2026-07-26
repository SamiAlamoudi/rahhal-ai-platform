/**
 * Speech Cleanup layer — runs between Speech Recognition and Conversation Brain.
 *
 * Pipeline: Recognition → Cleanup → Language validation → Normalization → Brain
 *
 * Raw STT output must never reach the conversation engine unchanged.
 */

/** Minimum Web Speech confidence to auto-send without clarification (0–1). */
export const SPEECH_CONFIDENCE_THRESHOLD = 0.55

/** Common English STT hallucination fragments mixed into Arabic speech. */
const HALLUCINATED_ENGLISH_FRAGMENTS = [
  /\b(thank you|thanks|you know|i mean|um+|uh+|ah+|okay|ok|hmm+)\b/gi,
  /\b(subtitle|subtitles|music|applause|laughter|cough)\b/gi,
  /\b(www\.|http|https)\S*/gi,
]

/**
 * Spoken Arabic digit words → Western digits.
 * Use Unicode letter boundaries — JS `\b` does not treat Arabic as word chars.
 */
const ARABIC_NUMBER_WORDS: Array<[RegExp, string]> = [
  [/(?<![\u0600-\u06FF])صفر(?![\u0600-\u06FF])/g, '0'],
  [/(?<![\u0600-\u06FF])واحدة?(?![\u0600-\u06FF])/g, '1'],
  [/(?<![\u0600-\u06FF])اثنين(?![\u0600-\u06FF])/g, '2'],
  [/(?<![\u0600-\u06FF])اثنان(?![\u0600-\u06FF])/g, '2'],
  [/(?<![\u0600-\u06FF])ثنتين(?![\u0600-\u06FF])/g, '2'],
  [/(?<![\u0600-\u06FF])ثلاثة(?![\u0600-\u06FF])/g, '3'],
  [/(?<![\u0600-\u06FF])ثلاث(?![\u0600-\u06FF])/g, '3'],
  [/(?<![\u0600-\u06FF])أربعة(?![\u0600-\u06FF])/g, '4'],
  [/(?<![\u0600-\u06FF])اربعة(?![\u0600-\u06FF])/g, '4'],
  [/(?<![\u0600-\u06FF])أربع(?![\u0600-\u06FF])/g, '4'],
  [/(?<![\u0600-\u06FF])خمسة(?![\u0600-\u06FF])/g, '5'],
  [/(?<![\u0600-\u06FF])خمس(?![\u0600-\u06FF])/g, '5'],
  [/(?<![\u0600-\u06FF])ستة(?![\u0600-\u06FF])/g, '6'],
  [/(?<![\u0600-\u06FF])ست(?![\u0600-\u06FF])/g, '6'],
  [/(?<![\u0600-\u06FF])سبعة(?![\u0600-\u06FF])/g, '7'],
  [/(?<![\u0600-\u06FF])سبع(?![\u0600-\u06FF])/g, '7'],
  [/(?<![\u0600-\u06FF])ثمانية(?![\u0600-\u06FF])/g, '8'],
  [/(?<![\u0600-\u06FF])ثمان(?![\u0600-\u06FF])/g, '8'],
  [/(?<![\u0600-\u06FF])تسعة(?![\u0600-\u06FF])/g, '9'],
  [/(?<![\u0600-\u06FF])تسع(?![\u0600-\u06FF])/g, '9'],
  [/(?<![\u0600-\u06FF])عشرة(?![\u0600-\u06FF])/g, '10'],
  [/(?<![\u0600-\u06FF])عشر(?![\u0600-\u06FF])/g, '10'],
]

/** Boundary-safe token: Latin word boundary or Arabic letter edges. */
const T = String.raw`(?:^|(?<![a-zA-Z\u0600-\u06FF]))`
const T_END = String.raw`(?=$|(?![a-zA-Z\u0600-\u06FF]))`

/** City / country aliases → canonical Arabic forms used in the product. */
const CITY_NORMALIZATIONS: Array<[RegExp, string]> = [
  [new RegExp(`${T}(marrakech|marrakesh|مراكش)${T_END}`, 'gi'), 'مراكش'],
  [new RegExp(`${T}(casablanca|الدار البيضاء|دار البيضاء)${T_END}`, 'gi'), 'الدار البيضاء'],
  [new RegExp(`${T}(agadir|أكادير|اكادير)${T_END}`, 'gi'), 'أكادير'],
  [new RegExp(`${T}(tangier|tanger|طنجة)${T_END}`, 'gi'), 'طنجة'],
  [new RegExp(`${T}(rabat|الرباط)${T_END}`, 'gi'), 'الرباط'],
  [new RegExp(`${T}(fes|fez|فاس)${T_END}`, 'gi'), 'فاس'],
  [new RegExp(`${T}(tokyo|طوكيو)${T_END}`, 'gi'), 'طوكيو'],
  [new RegExp(`${T}(kyoto|كيوتو)${T_END}`, 'gi'), 'كيوتو'],
  [new RegExp(`${T}(osaka|أوساكا|اوساكا)${T_END}`, 'gi'), 'أوساكا'],
  [new RegExp(`${T}(dubai|دبي)${T_END}`, 'gi'), 'دبي'],
  [new RegExp(`${T}(abu dhabi|أبوظبي|ابوظبي|أبو ظبي)${T_END}`, 'gi'), 'أبوظبي'],
  [new RegExp(`${T}(istanbul|إسطنبول|اسطنبول)${T_END}`, 'gi'), 'إسطنبول'],
  [new RegExp(`${T}(paris|باريس)${T_END}`, 'gi'), 'باريس'],
  [new RegExp(`${T}(cairo|القاهرة)${T_END}`, 'gi'), 'القاهرة'],
  [new RegExp(`${T}(bali|بالي)${T_END}`, 'gi'), 'بالي'],
  [new RegExp(`${T}(morocco|المغرب|للمغرب)${T_END}`, 'gi'), 'المغرب'],
  [new RegExp(`${T}(egypt|مصر)${T_END}`, 'gi'), 'مصر'],
  [new RegExp(`${T}(japan|اليابان|لليابان)${T_END}`, 'gi'), 'اليابان'],
  [new RegExp(`${T}(turkey|تركيا)${T_END}`, 'gi'), 'تركيا'],
  [new RegExp(`${T}(france|فرنسا)${T_END}`, 'gi'), 'فرنسا'],
  [new RegExp(`${T}(uae|emirates|الإمارات|الامارات|للإمارات)${T_END}`, 'gi'), 'الإمارات'],
]

const EASTERN_ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export interface SpeechCleanupResult {
  /** Normalized text safe to send to Conversation Brain (empty if blocked). */
  text: string
  /** Raw input after trim. */
  raw: string
  /** True when the utterance should not be auto-sent — ask the user instead. */
  needsClarification: boolean
  /** Arabic clarification prompt when needsClarification is true. */
  clarificationPrompt: string | null
  /** Effective language after validation. */
  language: 'ar' | 'en' | 'mixed' | 'unknown'
  /** Confidence used for the gate (0–1); null when unavailable. */
  confidence: number | null
}

const ENGLISH_TRAVEL_HINT =
  /\b(i|want|need|looking|book|flight|hotel|trip|travel|to|from|for|days?|weeks?|budget|please|can|you)\b/i

/**
 * True only when the utterance is clearly English (no Arabic letters + English cues).
 * Used to allow en-US recognition mid-session; never for default Arabic UI startup.
 */
export function isClearlyEnglish(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const arabic = (trimmed.match(/[\u0600-\u06FF]/g) ?? []).length
  const latin = (trimmed.match(/[a-zA-Z]/g) ?? []).length
  if (arabic > 0) return false
  if (latin < 4) return false
  return ENGLISH_TRAVEL_HINT.test(trimmed) || latin >= 12
}

export function countArabicLetters(text: string): number {
  return (text.match(/[\u0600-\u06FF]/g) ?? []).length
}

export function countLatinLetters(text: string): number {
  return (text.match(/[a-zA-Z]/g) ?? []).length
}

/** Normalize Eastern/Persian digits to Western 0–9. */
export function normalizeArabicDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (ch) => {
    const eastern = EASTERN_ARABIC_DIGITS.indexOf(ch)
    if (eastern >= 0) return String(eastern)
    const persian = PERSIAN_DIGITS.indexOf(ch)
    if (persian >= 0) return String(persian)
    return ch
  })
}

export function normalizeArabicNumberWords(text: string): string {
  let out = text
  for (const [pattern, digit] of ARABIC_NUMBER_WORDS) {
    out = out.replace(pattern, digit)
  }
  return out
}

export function normalizeCityNames(text: string): string {
  let out = text
  for (const [pattern, canonical] of CITY_NORMALIZATIONS) {
    out = out.replace(pattern, canonical)
  }
  return out
}

/** Collapse duplicated consecutive words (STT stutter): "دبي دبي" → "دبي". */
export function removeDuplicatedWords(text: string): string {
  return text
    .split(/(\s+)/)
    .reduce<string[]>((acc, token) => {
      if (/^\s+$/.test(token)) {
        acc.push(token)
        return acc
      }
      const prev = [...acc].reverse().find((t) => !/^\s+$/.test(t))
      if (prev && prev === token) return acc
      acc.push(token)
      return acc
    }, [])
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Strip short English fragments that often hallucinate into Arabic recognition.
 * Keeps clearly-English utterances intact.
 */
export function removeHallucinatedEnglish(text: string): string {
  if (isClearlyEnglish(text)) return text.trim()
  let out = text
  for (const pattern of HALLUCINATED_ENGLISH_FRAGMENTS) {
    out = out.replace(pattern, ' ')
  }
  // Lone Latin tokens of length ≤ 3 mixed into Arabic speech
  if (countArabicLetters(out) > 0) {
    out = out.replace(/(^|\s)[a-zA-Z]{1,3}(?=\s|$)/g, ' ')
  }
  return out.replace(/\s+/g, ' ').trim()
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function validateSpeechLanguage(
  text: string,
  uiLocale: 'ar' | 'en',
): { language: SpeechCleanupResult['language']; text: string } {
  if (!text.trim()) return { language: 'unknown', text: '' }

  if (uiLocale === 'ar') {
    if (isClearlyEnglish(text)) {
      return { language: 'en', text: text.trim() }
    }
    const cleaned = removeHallucinatedEnglish(text)
    const ar = countArabicLetters(cleaned)
    const la = countLatinLetters(cleaned)
    if (ar > 0 && la > ar) return { language: 'mixed', text: cleaned }
    if (ar > 0) return { language: 'ar', text: cleaned }
    if (la > 0) return { language: 'mixed', text: cleaned }
    return { language: 'unknown', text: cleaned }
  }

  if (isClearlyEnglish(text)) return { language: 'en', text: text.trim() }
  if (countArabicLetters(text) > 0) return { language: 'ar', text: text.trim() }
  return { language: 'en', text: text.trim() }
}

/** Destination-like tokens used for low-confidence clarification choices. */
const DESTINATION_HINTS = ['المغرب', 'مصر', 'اليابان', 'تركيا', 'فرنسا', 'الإمارات', 'دبي', 'باريس', 'مراكش', 'القاهرة']

export function extractDestinationCandidates(text: string): string[] {
  const found: string[] = []
  for (const name of DESTINATION_HINTS) {
    if (text.includes(name) && !found.includes(name)) found.push(name)
  }
  return found
}

/**
 * Build a never-guess clarification question.
 * Spec default: المغرب أم مصر when no better pair is available.
 */
export function buildLowConfidenceClarification(text: string): string {
  const candidates = extractDestinationCandidates(text)
  if (candidates.length >= 2) {
    return `لم ألتقط آخر جزء بوضوح، هل تقصد ${candidates[0]} أم ${candidates[1]}؟`
  }
  if (candidates.length === 1) {
    const other = candidates[0] === 'المغرب' ? 'مصر' : 'المغرب'
    return `لم ألتقط آخر جزء بوضوح، هل تقصد ${candidates[0]} أم ${other}؟`
  }
  return 'لم ألتقط آخر جزء بوضوح، هل تقصد المغرب أم مصر؟'
}

export function isLowSpeechConfidence(confidence: number | null | undefined): boolean {
  if (confidence == null || !Number.isFinite(confidence)) return false
  // Browsers (esp. Safari) often report 0 when unsupported — treat as unknown, not low.
  if (confidence <= 0) return false
  return confidence < SPEECH_CONFIDENCE_THRESHOLD
}

/**
 * Heuristic ambiguity when confidence is unavailable: very short garbled mix,
 * or conflicting destination tokens with weak Arabic signal.
 */
export function looksAmbiguousWithoutConfidence(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const destinations = extractDestinationCandidates(trimmed)
  if (destinations.length >= 2 && trimmed.length < 28) return true
  // Extreme stutter leftovers after dedupe failure patterns
  if (/(.)\1{5,}/.test(trimmed)) return true
  return false
}

/**
 * Full cleanup pipeline. Call before Conversation Brain / chatEngine.sendMessage.
 */
export function processSpeechTranscript(
  rawTranscript: string,
  options: {
    uiLocale?: 'ar' | 'en'
    confidence?: number | null
    /** Force clarification (tests / caller). */
    forceClarification?: boolean
  } = {},
): SpeechCleanupResult {
  const uiLocale = options.uiLocale ?? 'ar'
  const raw = normalizeWhitespace(rawTranscript)
  const confidence =
    options.confidence == null || !Number.isFinite(options.confidence)
      ? null
      : Math.max(0, Math.min(1, options.confidence))

  if (!raw) {
    return {
      text: '',
      raw: '',
      needsClarification: false,
      clarificationPrompt: null,
      language: 'unknown',
      confidence,
    }
  }

  // 1) Cleanup
  let text = removeHallucinatedEnglish(raw)
  text = removeDuplicatedWords(text)
  text = normalizeWhitespace(text)

  // 2) Language validation
  const langResult = validateSpeechLanguage(text, uiLocale)
  text = langResult.text

  // 3) Normalization
  text = normalizeArabicDigits(text)
  text = normalizeArabicNumberWords(text)
  text = normalizeCityNames(text)
  text = normalizeWhitespace(text)

  const lowConfidence = isLowSpeechConfidence(confidence)
  const ambiguous = confidence == null || confidence <= 0
    ? looksAmbiguousWithoutConfidence(text)
    : false
  const needsClarification = !!(options.forceClarification || lowConfidence || ambiguous)

  if (needsClarification) {
    return {
      text: '',
      raw,
      needsClarification: true,
      clarificationPrompt: buildLowConfidenceClarification(text || raw),
      language: langResult.language,
      confidence,
    }
  }

  return {
    text,
    raw,
    needsClarification: false,
    clarificationPrompt: null,
    language: langResult.language,
    confidence,
  }
}
