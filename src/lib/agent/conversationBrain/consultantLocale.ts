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
  lebanon: 'لبنان',
  beirut: 'بيروت',
  'لبنان': 'لبنان',
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

/** True when the model dumped slot inventory instead of speaking like a consultant. */
export function looksLikeInventoryDump(text: string, locale: 'ar' | 'en' = 'ar'): boolean {
  if (!text || locale !== 'ar') return false
  const t = text.trim()
  if (/Morocco|Marrakech|Agadir|Casablanca|\bSAR\b|\bUSD\b|\bAED\b|\bdays?\b|budget\b/i.test(t)) {
    return true
  }
  if (/واضح\s*عندي|عندي\s*:|I have this so far/i.test(t)) return true
  // "المغرب, 7 أيام, ريال…" / "… · 7d · 10000SAR"
  if (/^.{0,60},\s*\d+\s*أيام/.test(t)) return true
  if (/\d+\s*d\b|\d+\s*pax\b|\d{3,6}\s*SAR/i.test(t)) return true
  if ((t.match(/^[\s]*[-*•]/gm) || []).length >= 2) return true
  const latin = (t.match(/[A-Za-z]/g) || []).length
  const arabic = (t.match(/[\u0600-\u06FF]/g) || []).length
  if (latin >= 6 && latin >= Math.max(8, arabic * 0.25)) return true
  return false
}

/** Rewrite consultant prose so Arabic replies never leak English inventory tokens. */
export function polishConsultantProse(text: string, locale: 'ar' | 'en'): string {
  if (!text) return ''
  let out = text

  out = out
    .replace(/^عندي[:：]\s*/gm, '')
    .replace(/\bعندي\s*:/g, '')
    .replace(/واضح\s*عندي\s*[:：]?\s*/g, '')
    .replace(/\bI have:\s*/gi, '')
    .replace(/\bI have this so far:\s*/gi, '')

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
      .replace(/\b\d+\s*d\b/gi, (m) => {
        const n = m.match(/\d+/)?.[0]
        return n ? `${n} أيام` : m
      })
      .replace(/\b\d+\s*pax\b/gi, '')
      .replace(/\bflexible-budget\b/gi, 'ميزانية مرنة')
  }

  return out
    .replace(/^[\s]*[-*•]\s+/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s*·\s*/g, '، ')
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
