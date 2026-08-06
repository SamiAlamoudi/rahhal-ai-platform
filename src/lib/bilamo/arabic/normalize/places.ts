/**
 * City / country robustness — Arabic variants, English, mixed, typos, clitics.
 */

const PLACE_RULES: Array<{ re: RegExp; to: string }> = [
  // Clitics first (للرياض → إلى الرياض), then spelling repair.
  { re: /(?:^|[\s،,])لل?(?:ال)?رياض/g, to: ' إلى الرياض' },
  { re: /(?:^|[\s،,])لل?(?:ال)?قاهرة/g, to: ' إلى القاهرة' },
  { re: /(?:^|[\s،,])لليابان/g, to: ' إلى اليابان' },
  { re: /(?:^|[\s،,])لل?(دبي|جدة|باريس|لندن|طوكيو|اسطنبول|مصر|بالي|بيروت|بغداد|تونس|الكويت|الدوحة)/g, to: ' إلى $1' },

  // Common ASR / dialect / missing-hamza forms
  { re: /ال\s*رياض|الرياص|الرياذ|إلى\s+رياض|(?<![\u0600-\u06FF])رياض(?![\u0600-\u06FF])/g, to: 'الرياض' },
  { re: /جده|جدّه|جدّة/g, to: 'جدة' },
  { re: /دبى|دبيّ/g, to: 'دبي' },
  { re: /القاهره|قاهره/g, to: 'القاهرة' },
  { re: /اسطنبول|إسطنبول|إستانبول|استانبول/g, to: 'اسطنبول' },
  { re: /توکیو/g, to: 'طوكيو' },
  { re: /لنادن/g, to: 'لندن' },
  { re: /باريز/g, to: 'باريس' },
  { re: /لشبونه|ليسبون/g, to: 'لشبونة' },
  { re: /جزر\s*المالديف/g, to: 'المالديف' },
  { re: /الدوحه/g, to: 'الدوحة' },
  { re: /ابو\s*ظبي|أبو\s*ظبي|ابوظبي/g, to: 'أبوظبي' },
  { re: /مسكط/g, to: 'مسقط' },
  { re: /صنعأ/g, to: 'صنعاء' },
  { re: /بيرؤت/g, to: 'بيروت' },
  { re: /بغدات/g, to: 'بغداد' },
  { re: /الدار\s*البيضاء|كازا/g, to: 'الدار البيضاء' },
  { re: /تونس\s*العاصمه|تونس\s*العاصمة/g, to: 'تونس' },
  { re: /خرطوم/g, to: 'الخرطوم' },

  // Mixed English common typos
  { re: /\bRyadh\b|\bRiyad\b/gi, to: 'Riyadh' },
  { re: /\bDubay\b|\bDubayy\b/gi, to: 'Dubai' },
  { re: /\bIstanbull\b|\bIstambul\b/gi, to: 'Istanbul' },
  { re: /\bTokoyo\b|\bTokio\b/gi, to: 'Tokyo' },
  { re: /\bParee\b|\bParris\b/gi, to: 'Paris' },
]

export function normalizePlaceNames(text: string): { text: string; changed: boolean } {
  let out = text
  let changed = false
  for (const rule of PLACE_RULES) {
    const next = out.replace(rule.re, rule.to)
    if (next !== out) {
      changed = true
      out = next
    }
  }
  out = out.replace(/\s+/g, ' ').trim()
  return { text: out, changed }
}
