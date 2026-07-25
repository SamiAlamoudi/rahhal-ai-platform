/**
 * Integration Sprint 8 — detect spatial / mobility intents from traveler text.
 */

import type { MapsMobilityIntent, MobilityMode } from './types'

export function detectMapsMobilityIntent(userText: string | null | undefined): MapsMobilityIntent {
  const t = (userText ?? '').trim()
  if (!t) return 'unknown'
  if (/where am i|أين أنا|وين أنا|موقعي/i.test(t)) return 'where_am_i'
  if (/when should i leave|متى أغادر|leave by|وقت المغادرة/i.test(t)) return 'leave_by'
  if (/(?:^|[^a-z])eta(?:[^a-z]|$)|how long|كم يستغرق|متى أصل|arrival time/i.test(t)) return 'eta'
  if (/how (do|can) i get|كيف أصل|directions|route|طريق|موصل/i.test(t)) return 'how_to_get_there'
  if (/nearby|قريب|around me|حولي|suggest .*near/i.test(t)) return 'nearby'
  if (/map|خريطة|navigate|تنقل|walking route|مسار مشي/i.test(t)) return 'route'
  return 'unknown'
}

export function isMapsMobilityAsk(userText: string | null | undefined): boolean {
  return detectMapsMobilityIntent(userText) !== 'unknown'
}

export function detectMobilityMode(userText: string | null | undefined): MobilityMode | null {
  const t = (userText ?? '').toLowerCase()
  if (/walk|مشي|على الأقدام/.test(t)) return 'walking'
  if (/transit|metro|مترو|train|قطار|bus|حافلة/.test(t)) return 'transit'
  if (/taxi|تاكسي/.test(t)) return 'taxi'
  if (/uber|careem|rideshare|تطبيق توصيل/.test(t)) return 'rideshare'
  if (/drive|driving|سيارة|قيادة/.test(t)) return 'driving'
  return null
}

/** Extract "from X to Y" style destination cues. */
export function extractRouteEndpoints(userText: string): { from?: string; to?: string } {
  const t = userText.trim()
  const m1 = t.match(/(?:from|من)\s+(.+?)\s+(?:to|إلى|الى)\s+(.+?)(?:\?|$)/i)
  if (m1?.[1] && m1[2]) return { from: m1[1].trim(), to: m1[2].trim() }
  const m2 = t.match(/(?:to|إلى|الى|near|قرب)\s+([^\n؟?]{2,60})/i)
  if (m2?.[1]) return { to: m2[1].trim() }
  return {}
}
