/**
 * Orthographic prep — diacritics, hamza variants, digits, spacing.
 * Safe for extraction; does not change traveler-facing display text.
 */

const DIACRITICS_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g

export function easternDigitsToAscii(text: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  }
  return text.replace(/[٠-٩۰-۹]/g, (ch) => map[ch] ?? ch)
}

export function stripArabicDiacritics(text: string): string {
  return text.replace(DIACRITICS_RE, '')
}

/** Collapse common hamza / alef spelling variants for matching. */
export function softenArabicOrthography(text: string): string {
  return text
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
}

export function prepArabicText(text: string): { text: string; changed: boolean } {
  const original = text || ''
  let out = easternDigitsToAscii(original)
  out = stripArabicDiacritics(out)
  // Keep readable Arabic for extractors (they use original forms too),
  // but fix ASR / clitic spacing that breaks city matchers.
  out = out
    .replace(/ال\s+رياض/g, 'الرياض')
    .replace(/ال\s+قاهره|ال\s+قاهرة/g, 'القاهرة')
    .replace(/طو\s*كيو/g, 'طوكيو')
    .replace(/اس\s*طنبول|اسط?\s*نبول/g, 'اسطنبول')
    .replace(/\s+/g, ' ')
    .trim()
  return { text: out, changed: out !== original.trim() }
}
