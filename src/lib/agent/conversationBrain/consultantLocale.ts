/**
 * Locale-facing labels for consultant speech/display.
 * Internal trip state may keep English keys (Morocco, SAR); travelers never see them in ar.
 */

const DESTINATION_AR: Record<string, string> = {
  morocco: 'المغرب',
  marrakech: 'مراكش',
  marrakesh: 'مراكش',
  casablanca: 'الدار البيضاء',
  agadir: 'أكادير',
  rabat: 'الرباط',
  fez: 'فاس',
  fes: 'فاس',
  tangier: 'طنجة',
  dubai: 'دبي',
  riyadh: 'الرياض',
  jeddah: 'جدة',
  paris: 'باريس',
  istanbul: 'إسطنبول',
  london: 'لندن',
  cairo: 'القاهرة',
  rome: 'روما',
  barcelona: 'برشلونة',
  tokyo: 'طوكيو',
  osaka: 'أوساكا',
  kyoto: 'كيوتو',
  japan: 'اليابان',
  maldives: 'المالديف',
  bali: 'بالي',
  switzerland: 'سويسرا',
  austria: 'النمسا',
  norway: 'النرويج',
  canada: 'كندا',
  iceland: 'آيسلندا',
  'new zealand': 'نيوزيلندا',
}

const CURRENCY_AR: Record<string, string> = {
  sar: 'ريال',
  'saudi riyal': 'ريال',
  usd: 'دولار',
  eur: 'يورو',
  aed: 'درهم',
  egp: 'جنيه',
  mad: 'درهم مغربي',
}

export function destinationLabel(value: string | null | undefined, locale: 'ar' | 'en'): string {
  if (!value) return locale === 'ar' ? 'وجهتكم' : 'your destination'
  const key = value.trim().toLowerCase()
  if (locale === 'ar') return DESTINATION_AR[key] || value
  return value
}

export function currencyLabel(currency: string | null | undefined, locale: 'ar' | 'en'): string {
  if (!currency) return locale === 'ar' ? 'ريال' : 'SAR'
  const key = currency.trim().toLowerCase()
  if (locale === 'ar') return CURRENCY_AR[key] || currency
  return currency.toUpperCase()
}

export function formatBudgetPhrase(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale: 'ar' | 'en',
): string {
  if (amount == null) return ''
  const cur = currencyLabel(currency, locale)
  if (locale === 'ar') {
    return `${amount.toLocaleString('ar-SA')} ${cur}`
  }
  return `${amount.toLocaleString('en-US')} ${cur}`
}

/** Rewrite consultant prose so Arabic replies never leak English inventory tokens. */
export function polishConsultantProse(text: string, locale: 'ar' | 'en'): string {
  if (!text) return ''
  let out = text

  out = out
    .replace(/^عندي[:：]\s*/gm, '')
    .replace(/\bعندي\s*:/g, '')
    .replace(/\bI have:\s*/gi, '')

  if (locale === 'ar') {
    const pairs = Object.entries(DESTINATION_AR).sort((a, b) => b[0].length - a[0].length)
    for (const [en, ar] of pairs) {
      const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      out = out.replace(re, ar)
    }
    out = out
      .replace(/\bMock Hotel\b/gi, 'فندق مناسب')
      .replace(/\bOld Town\b/gi, 'البلدة القديمة')
      .replace(/\bViewpoint\b/gi, 'نقطة مشاهدة')
      .replace(/\bMarket\b/gi, 'السوق')
      .replace(/\bSAR\b/gi, 'ريال')
      .replace(/\bUSD\b/gi, 'دولار')
      .replace(/\bEUR\b/gi, 'يورو')
      .replace(/\bAED\b/gi, 'درهم')
      .replace(/\bMAD\b/gi, 'درهم مغربي')
      // Drop leftover Latin inventory crumbs like "7 days," mixed dumps.
      .replace(/\b\d+\s*days?\b/gi, (m) => {
        const n = m.match(/\d+/)?.[0]
        return n ? `${n} أيام` : m
      })
  }

  return out
    .replace(/^[\s]*[-*•]\s+/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Split display text into short premium paragraphs. */
export function formatConsultantParagraphs(text: string): string {
  const polished = text.replace(/\r/g, '').trim()
  if (!polished) return ''
  // If model already used blank lines, keep them.
  if (/\n\s*\n/.test(polished)) {
    return polished
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n\n')
  }
  // Otherwise break on sentence boundaries into 2–4 short paragraphs.
  const sentences = polished
    .split(/(?<=[.!?؟。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length <= 2) return sentences.join(' ')
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(' '))
  }
  return chunks.join('\n\n')
}
