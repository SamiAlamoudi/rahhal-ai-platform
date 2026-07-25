/**
 * Integration Sprint 2 — natural travel-consultant summaries (never raw JSON).
 */

import type { RankedConversationFlight } from './types'

function hoursLabel(minutes: number | null, locale: 'ar' | 'en'): string {
  if (minutes == null || !Number.isFinite(minutes)) return locale === 'ar' ? '—' : '—'
  const h = Math.round((minutes / 60) * 10) / 10
  return locale === 'ar' ? `${h} ساعة` : `${h}h`
}

function stopsLabel(stops: number | null, locale: 'ar' | 'en'): string {
  if (stops == null) return ''
  if (stops <= 0) return locale === 'ar' ? 'مباشرة' : 'non-stop'
  if (stops === 1) return locale === 'ar' ? 'توقف واحد' : '1 stop'
  return locale === 'ar' ? `${stops} توقفات` : `${stops} stops`
}

export function buildConsultantFlightSummary(
  flights: RankedConversationFlight[],
  meta: {
    origin: string
    destination: string
    departureDate: string
    returnDate: string | null
    empty?: boolean
    graceful?: boolean
  },
): { ar: string; en: string } {
  if (meta.empty || flights.length === 0) {
    if (meta.graceful) {
      return {
        ar: `تعذّر جلب عروض حية من ${meta.origin} إلى ${meta.destination} الآن — يمكننا إعادة المحاولة أو ضبط التواريخ.`,
        en: `I couldn't fetch live offers from ${meta.origin} to ${meta.destination} right now — we can retry or adjust dates.`,
      }
    }
    return {
      ar: `ما لقيت عروض مناسبة من ${meta.origin} إلى ${meta.destination} لهذا التاريخ. نقدر نوسّع المرونة يوم أو يومين.`,
      en: `I didn't find suitable offers from ${meta.origin} to ${meta.destination} for that date. We can loosen dates by a day or two.`,
    }
  }

  const top = flights.slice(0, 3)
  const best = top[0]!
  const route = `${meta.origin} → ${meta.destination}`
  const returnBitAr = meta.returnDate ? ` ذهاب وعودة (عودة ${meta.returnDate})` : ' ذهاب فقط'
  const returnBitEn = meta.returnDate ? ` round-trip (return ${meta.returnDate})` : ' one-way'

  const linesAr = top.map((f, i) => {
    const n = i + 1
    const airline = f.airline ?? 'الناقل'
    const price = f.price != null ? `${f.price} ${f.currency}` : 'السعر عند التأكيد'
    return `${n}) ${airline} — ${price} — ${stopsLabel(f.stops, 'ar')} — ${hoursLabel(f.durationMinutes, 'ar')}. السبب: ${f.whyAr}.`
  })

  const linesEn = top.map((f, i) => {
    const n = i + 1
    const airline = f.airline ?? 'Carrier'
    const price = f.price != null ? `${f.price} ${f.currency}` : 'price on confirm'
    return `${n}) ${airline} — ${price} — ${stopsLabel(f.stops, 'en')} — ${hoursLabel(f.durationMinutes, 'en')}. Why: ${f.whyEn}.`
  })

  return {
    ar: [
      `لرحلتك ${route}${returnBitAr} بتاريخ ${meta.departureDate}، هذه أفضل الخيارات مرتبة لك:`,
      ...linesAr,
      best.price != null
        ? `أقترح نبدأ بالخيار الأول إن ناسبك، أو نضيّق حسب الميزانية أو شركة الطيران.`
        : `قلّي إن حاب نفلتر بالسعر أو التوقفات.`,
    ].join('\n'),
    en: [
      `For ${route}${returnBitEn} on ${meta.departureDate}, here are the best options ranked for you:`,
      ...linesEn,
      `I'd start with option 1 if it fits — or we can filter by budget or airline.`,
    ].join('\n'),
  }
}

export function highlightLines(flights: RankedConversationFlight[]): {
  best: string | null
  cheapest: string | null
  fastest: string | null
} {
  if (flights.length === 0) {
    return { best: null, cheapest: null, fastest: null }
  }
  const best = flights[0]!
  const byPrice = [...flights].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0]!
  const byDuration = [...flights].sort(
    (a, b) => (a.durationMinutes ?? Infinity) - (b.durationMinutes ?? Infinity),
  )[0]!

  const fmt = (f: RankedConversationFlight) =>
    `${f.airline ?? 'Carrier'} ${f.origin}→${f.destination} · ${f.price ?? '—'} ${f.currency}`

  return {
    best: fmt(best),
    cheapest: fmt(byPrice),
    fastest: `${byDuration.airline ?? 'Carrier'} · ${hoursLabel(byDuration.durationMinutes, 'en')}`,
  }
}
