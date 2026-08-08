/**
 * Keep spokenText short, conversational, and Arabic-first for Arabic voice turns.
 * Cards remain visual — voice only summarizes like a consultant.
 */

const ENGLISH_TEMPLATE_FRAGMENTS = [
  /\bWhen are\b[^?.!]{0,80}[?.!]?/gi,
  /\bUnderstood\b[—\-–,]?\s*/gi,
  /\bOf course\b[.—\-–,]?\s*/gi,
  /\bWonderful\b[—\-–,]?\s*/gi,
  /\bSolo,?\s+or with someone\??/gi,
  /\bTraveling solo\b[^?.!]{0,60}[?.!]?/gi,
  /\bTell me a little more\b[^?.!]{0,80}[?.!]?/gi,
]

const ARABIC_CHAR = /[\u0600-\u06FF]/

/** True when text has meaningful Arabic script. */
export function hasArabicScript(text: string): boolean {
  return ARABIC_CHAR.test(text)
}

/**
 * Strip known English template pollution from Arabic spoken lines.
 * Preserves English proper nouns / IATA codes embedded in Arabic sentences.
 */
export function stripEnglishTemplateFragments(text: string): string {
  let out = text
  for (const re of ENGLISH_TEMPLATE_FRAGMENTS) {
    out = out.replace(re, ' ')
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Prepare spokenText for classic TTS.
 * - Arabic voice: Arabic-first, strip English template fragments, keep short.
 * - Never TTS long card/itinerary blocks.
 */
export function prepareSpokenTextForTts(
  text: string,
  locale: 'ar' | 'en' | 'fr' | string,
  maxChars = 220,
): string {
  let spoken = (text || '').trim()
  if (!spoken) return ''

  // Arabic-first even when locale mis-detects as en/fr but the line has Arabic script
  // (fixes "Understood" / "When are" pollution mixed into Arabic spokenText).
  if (locale === 'ar' || hasArabicScript(spoken)) {
    spoken = stripEnglishTemplateFragments(spoken)
    // Drop orphan punctuation / empty residue after English template removal.
    spoken = spoken.replace(/^[\s.!?؟،,;:]+|[\s.!?؟،,;:]+$/g, '').trim()
    // If after stripping we lost Arabic entirely, do not TTS English leftovers.
    if (!hasArabicScript(spoken)) {
      return ''
    }
  }

  // Soft length cap — consultant summary, not card dump.
  if (spoken.length > maxChars) {
    const cut = spoken.slice(0, maxChars)
    const lastPause = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('.'), cut.lastIndexOf('،'), cut.lastIndexOf(' '))
    spoken = (lastPause > 80 ? cut.slice(0, lastPause) : cut).trim()
  }
  return spoken
}
