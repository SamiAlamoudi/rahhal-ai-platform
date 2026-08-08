/**
 * Context-sensitive Bilamo brand ASR normalization.
 *
 * ASR often hears "بيلامو" as "بلال". Fix only when the traveler is clearly
 * addressing/greeting the assistant — never rewrite a person named بلال.
 *
 * Note: JS `\b` is unreliable for Arabic — use explicit Arabic/space boundaries.
 */

export type BilamoBrandAsrResult = {
  /** Text after brand normalization (safe for display + extract). */
  normalized: string
  /** True when the utterance addresses Bilamo (or already contains the brand). */
  assistantNameMatch: boolean
  /** True when a person-name context preserved بلال. */
  preservedPersonBilal: boolean
}

const BILAL = 'بلال'
const BILAMO = 'بيلامو'

/** Acoustic / orthographic brand variants (not the person name بلال). */
const BRAND_VARIANT_RE = /بيلامو|بلامو|بلا\s*مو|بي\s*لامو/g
const LATIN_BRAND_RE = /\b[Bb](?:ilamo|elamo|illamo|ilalmo)\b/g

function hasBilalToken(text: string): boolean {
  return new RegExp(`(?:^|[\\s،,])${BILAL}(?=$|[\\s.!؟،,])`, 'u').test(text)
}

function replaceBilalWithBilamo(text: string): string {
  return text.replace(new RegExp(`(^|[\\s،,])${BILAL}(?=$|[\\s.!؟،,])`, 'gu'), `$1${BILAMO}`)
}

/** Person-name contexts that must keep بلال. */
function isPersonBilalContext(text: string): boolean {
  return (
    /(?:اسمي|اسمه|اسمها|اسمُه)\s*بلال(?:$|[\s.!؟،,])/u.test(text)
    || /(?:أنا|انا)\s+مع\s*بلال(?:$|[\s.!؟،,])/u.test(text)
    || /(?:^|[\s،,])مع\s*بلال(?:$|[\s.!؟،,])/u.test(text)
    || /بلال\s+(?:بيسافر|يسافر|معاي|معي|جاي|راح|معانا)/u.test(text)
  )
}

/** Greeting / vocative address of the assistant. */
function isAssistantAddressContext(text: string): boolean {
  if (/^(?:مرحبا|مرحبًا|مرحباً|هلا|اهلا|أهلا|أهلاً|يا|السلام\s*عليكم|سلام)(?:\s|$)/u.test(text)) {
    return true
  }
  if (/^(?:مرحبا|مرحبًا|مرحباً|هلا|اهلا|أهلا|أهلاً)\s+بلال(?:$|[\s.!؟،,])/u.test(text)) {
    return true
  }
  if (/^بلال\s+(?:أبغى|ابغى|أريد|اريد|عايز|عاوز|بدي|بغيت|رتّب|رتب)/u.test(text)) {
    return true
  }
  if (/^(?:يا\s+)?بلال\s*[.!؟]?$/u.test(text)) {
    return true
  }
  return false
}

export function normalizeBilamoAssistantName(raw: string): BilamoBrandAsrResult {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (!text) {
    return { normalized: '', assistantNameMatch: false, preservedPersonBilal: false }
  }

  // Always canonicalize clear brand spellings (never collide with بلال).
  let out = text
    .replace(BRAND_VARIANT_RE, BILAMO)
    .replace(LATIN_BRAND_RE, 'Bilamo')

  if (isPersonBilalContext(out)) {
    return {
      normalized: out,
      assistantNameMatch: /بيلامو|Bilamo/i.test(out),
      preservedPersonBilal: hasBilalToken(out),
    }
  }

  if (isAssistantAddressContext(out) && hasBilalToken(out)) {
    out = replaceBilalWithBilamo(out)
    return { normalized: out, assistantNameMatch: true, preservedPersonBilal: false }
  }

  const hasBrand = /بيلامو|Bilamo/i.test(out)
  return {
    normalized: out,
    assistantNameMatch: hasBrand,
    preservedPersonBilal: false,
  }
}

/** Prompt bias for OpenAI realtime / GPT transcribe vocabulary. */
export const BILAMO_TRANSCRIPTION_PROMPT =
  'The assistant product name is Bilamo (بيلامو). '
  + 'When the traveler greets or addresses the assistant, transcribe بيلامو / Bilamo — not بلال. '
  + 'Keep بلال only when it is clearly a person name (e.g. اسمي بلال، مع بلال).'
