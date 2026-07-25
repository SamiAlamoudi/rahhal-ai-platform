/**
 * Integration Sprint 3 — natural hotel consultant summaries (never raw JSON).
 */

import type { RankedConversationHotel } from './types'

export function buildConsultantHotelSummary(
  stays: RankedConversationHotel[],
  meta: {
    destination: string
    checkIn: string
    checkOut: string
    empty?: boolean
    graceful?: boolean
  },
): { ar: string; en: string } {
  if (meta.empty || stays.length === 0) {
    if (meta.graceful) {
      return {
        ar: `تعذّر جلب فنادق حية في ${meta.destination} الآن — نقدر نعيد المحاولة أو نعدّل التواريخ.`,
        en: `I couldn't fetch live hotels in ${meta.destination} right now — we can retry or adjust dates.`,
      }
    }
    return {
      ar: `ما لقيت إقامات مناسبة في ${meta.destination} لهذه التواريخ. نقدر نوسّع المنطقة أو الميزانية.`,
      en: `I didn't find suitable stays in ${meta.destination} for those dates. We can widen the area or budget.`,
    }
  }

  const top = stays.slice(0, 3)
  const linesAr = top.map((h, i) => {
    const price = h.pricePerNight != null ? `${h.pricePerNight} ${h.currency}/ليلة` : 'السعر عند التأكيد'
    const stars = h.stars != null ? `${h.stars}★` : ''
    return `${i + 1}) ${h.hotelName} ${stars} — ${price}. السبب: ${h.whyAr}.`
  })
  const linesEn = top.map((h, i) => {
    const price = h.pricePerNight != null ? `${h.pricePerNight} ${h.currency}/night` : 'price on confirm'
    const stars = h.stars != null ? `${h.stars}★` : ''
    return `${i + 1}) ${h.hotelName} ${stars} — ${price}. Why: ${h.whyEn}.`
  })

  return {
    ar: [
      `لإقامتك في ${meta.destination} من ${meta.checkIn} إلى ${meta.checkOut}، هذه أفضل الخيارات مرتبة لك:`,
      ...linesAr,
      `أقترح نبدأ بالخيار الأول إن ناسبك، أو نفلتر (إفطار / إلغاء مجاني / مسبح).`,
    ].join('\n'),
    en: [
      `For your stay in ${meta.destination} from ${meta.checkIn} to ${meta.checkOut}, here are the best options ranked for you:`,
      ...linesEn,
      `I'd start with option 1 if it fits — or we can filter (breakfast / free cancellation / pool).`,
    ].join('\n'),
  }
}

export function hotelHighlightLines(stays: RankedConversationHotel[]): {
  best: string | null
  cheapest: string | null
  highestRated: string | null
} {
  if (stays.length === 0) return { best: null, cheapest: null, highestRated: null }
  const best = stays[0]!
  const cheapest = [...stays].sort(
    (a, b) => (a.pricePerNight ?? Infinity) - (b.pricePerNight ?? Infinity),
  )[0]!
  const highestRated = [...stays].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]!
  const fmt = (h: RankedConversationHotel) =>
    `${h.hotelName} · ${h.pricePerNight ?? '—'} ${h.currency}/night`
  return {
    best: fmt(best),
    cheapest: fmt(cheapest),
    highestRated: `${highestRated.hotelName} · ★${highestRated.rating ?? '—'}`,
  }
}
