/**
 * Post-lock Arabic ASR helpers.
 * Enrich structured extraction only — never rewrite the displayed / committed transcript.
 */

/** Eastern Arabic / Persian digits → Western digits for parsers. */
export function easternDigitsToAscii(text: string): string {
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  }
  return text.replace(/[٠-٩۰-۹]/g, (ch) => map[ch] ?? ch)
}

const ARABIC_DAY_WORDS: Array<{ re: RegExp; day: number }> = [
  { re: /ثلاثة\s*عشر|ثلاث\s*عشر/g, day: 13 },
  { re: /اثنا?\s*عشر|اثني\s*عشر/g, day: 12 },
  { re: /أحد\s*عشر|احد\s*عشر|إحدى\s*عشر/g, day: 11 },
  { re: /عشرة|عشر(?!\s*أغسطس|\s*اغسطس)/g, day: 10 },
  { re: /تسعة/g, day: 9 },
  { re: /ثمانية/g, day: 8 },
  { re: /سبعة/g, day: 7 },
  { re: /ستة/g, day: 6 },
  { re: /خمسة/g, day: 5 },
  { re: /أربعة|اربعة/g, day: 4 },
  { re: /ثلاثة|ثلاث(?!\s*عشر)/g, day: 3 },
  { re: /اثنين|اثنان|اثنتين/g, day: 2 },
  { re: /واحد|واحدة|أولى|اولى/g, day: 1 },
]

/**
 * Normalize Arabic ASR text for requirement parsers only.
 * Display / committed transcript must stay the original exact string.
 */
export function normalizeArabicAsrForExtraction(text: string): string {
  let out = easternDigitsToAscii(text || '')

  // Word-number days before month names: "ثلاثة أغسطس" → "3 أغسطس"
  const monthAr = 'يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر'
  for (const { re, day } of ARABIC_DAY_WORDS) {
    const dayBeforeMonth = new RegExp(
      `(${sourceWithoutFlags(re)})\\s+(${monthAr})`,
      'g',
    )
    out = out.replace(dayBeforeMonth, `${day} $2`)
  }

  // Common ASR spacing / hamza variants that break city + cabin matchers.
  out = out
    .replace(/ال\s+رياض/g, 'الرياض')
    .replace(/طو\s*كيو/g, 'طوكيو')
    .replace(/بان\s*كوك/g, 'بانكوك')
    .replace(/بو\s*كيت/g, 'بوكيت')
    .replace(/درجة\s+الضيافة|على\s+الضيافة|بالضيافة/g, 'درجة اقتصادية')
    .replace(/درجة\s+الأعمال|درجة\s+اعمال/g, 'درجة رجال الأعمال')
    .replace(/أنا\s+وزوجتي|انا\s+وزوجتي|أنا\s+و زوجتي/g, 'لشخصين')
    .replace(/أبغى\s+أسافر|ابغى\s+اسافر/g, 'أريد السفر')

  return out
}

function sourceWithoutFlags(re: RegExp): string {
  return re.source
}

export type AsrCompletenessVerdict =
  | { ok: true }
  | { ok: false; reason: 'too_short_for_audio' | 'wrong_script' | 'empty'; retryMessageAr: string; retryMessageEn: string }

const ARABIC_RE = /[\u0600-\u06FF]/
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/
const CYRILLIC_RE = /[\u0400-\u04FF]/

/**
 * Reject incomplete finals when audio was long but ASR returned a fragment.
 */
export function assessAsrCompleteness(input: {
  transcript: string
  audioDurationMs: number
  conversationLanguage: 'ar' | 'en' | string | null
}): AsrCompletenessVerdict {
  const text = (input.transcript || '').trim()
  if (!text) {
    return {
      ok: false,
      reason: 'empty',
      retryMessageAr: 'ما سمعت الطلب كامل. عِد الجملة لو سمحت.',
      retryMessageEn: 'I did not catch the full request. Please say it again.',
    }
  }

  const lang = input.conversationLanguage || 'ar'
  if (lang === 'ar' || lang === 'ur') {
    if (CJK_RE.test(text) || CYRILLIC_RE.test(text)) {
      return {
        ok: false,
        reason: 'wrong_script',
        retryMessageAr: 'ما قدرت ألتقط العربية بوضوح. عِد الطلب مرة ثانية.',
        retryMessageEn: 'I could not capture Arabic clearly. Please repeat your request.',
      }
    }
    // Pure Latin during Arabic session (and not a short confirm) → retry.
    if (!ARABIC_RE.test(text) && /[A-Za-z]/.test(text) && text.replace(/[^\p{L}]/gu, '').length >= 6) {
      return {
        ok: false,
        reason: 'wrong_script',
        retryMessageAr: 'ما قدرت ألتقط العربية بوضوح. عِد الطلب مرة ثانية.',
        retryMessageEn: 'I could not capture Arabic clearly. Please repeat your request.',
      }
    }
  }

  const letters = text.replace(/[^\p{L}\p{N}]/gu, '').length
  const durationMs = Math.max(0, input.audioDurationMs || 0)
  const durationSec = durationMs / 1000

  // Long audio + tiny transcript = truncated ASR (e.g. 8s → "من 13").
  if (durationSec >= 7 && letters < 14) {
    return {
      ok: false,
      reason: 'too_short_for_audio',
      retryMessageAr: 'الجملة ما اكتملت بالتعرف. عِد طلب الحجز كامل من فضلك.',
      retryMessageEn: 'The request looked incomplete. Please repeat the full booking sentence.',
    }
  }
  if (durationSec >= 5 && letters < 8) {
    return {
      ok: false,
      reason: 'too_short_for_audio',
      retryMessageAr: 'الجملة ما اكتملت بالتعرف. عِد طلب الحجز كامل من فضلك.',
      retryMessageEn: 'The request looked incomplete. Please repeat the full booking sentence.',
    }
  }
  if (durationSec >= 3.5 && letters < 4) {
    return {
      ok: false,
      reason: 'too_short_for_audio',
      retryMessageAr: 'ما سمعت الطلب كامل. عِد الجملة لو سمحت.',
      retryMessageEn: 'I did not catch the full request. Please say it again.',
    }
  }

  return { ok: true }
}
