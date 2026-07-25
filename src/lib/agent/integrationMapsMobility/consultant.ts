/**
 * Integration Sprint 8 — natural spatial summaries (no raw provider dumps).
 */

import type { MapsMobilityResult } from './types'

export function buildMapsMobilitySummary(
  result: Pick<
    MapsMobilityResult,
    'intent' | 'spatial' | 'route' | 'alternatives' | 'nearby' | 'origin' | 'destination' | 'live'
  >,
): { en: string; ar: string } {
  const liveBit = result.live ? 'Live maps' : 'Mock spatial layer'

  if (result.intent === 'where_am_i') {
    const label = result.origin?.labelEn ?? result.spatial.currentLabelEn ?? 'an unknown spot'
    const labelAr = result.origin?.labelAr ?? result.spatial.currentLabelAr ?? 'موقع غير محدد'
    return {
      en: `You’re around ${label}${result.spatial.city ? ` in ${result.spatial.city}` : ''}. (${liveBit})`,
      ar: `أنت حول ${labelAr}${result.spatial.city ? ` في ${result.spatial.city}` : ''}. (${result.live ? 'خرائط مباشرة' : 'طبقة مكانية تجريبية'})`,
    }
  }

  if (result.route) {
    const r = result.route
    const leave = r.leaveByIso
      ? ` Leave by ${new Date(r.leaveByIso).toISOString().slice(11, 16)} UTC.`
      : ''
    const alt = result.alternatives[0]
      ? ` Alt: ${result.alternatives[0].mode} ~${result.alternatives[0].durationMinutes} min.`
      : ''
    return {
      en: `Route ${r.from.labelEn} → ${r.to.labelEn}: ${r.summaryEn}.${leave}${alt}`,
      ar: `المسار ${r.from.labelAr} → ${r.to.labelAr}: ${r.summaryAr}.${leave ? ` غادر قبل ${new Date(r.leaveByIso!).toISOString().slice(11, 16)} UTC.` : ''}${alt ? ` بديل: ${result.alternatives[0]!.mode}` : ''}`,
    }
  }

  if (result.nearby.length) {
    const top = result.nearby.slice(0, 3).map((n) => n.place.labelEn).join(', ')
    const topAr = result.nearby.slice(0, 3).map((n) => n.place.labelAr).join('، ')
    return {
      en: `Nearby ideas: ${top}. ${result.nearby[0]!.whyEn}`,
      ar: `اقتراحات قريبة: ${topAr}. ${result.nearby[0]!.whyAr}`,
    }
  }

  return {
    en: 'Tell me where you are heading (airport, hotel, attraction) and I’ll outline how to get there.',
    ar: 'أخبرني إلى أين تتجه (مطار، فندق، معلم) وسأوضح كيف تصل.',
  }
}
