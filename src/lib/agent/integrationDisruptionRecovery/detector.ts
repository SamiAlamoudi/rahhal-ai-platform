/**
 * Integration Sprint 10 — disruption detection from traveler text.
 */

import type { DetectedLiveDisruption, DisruptionKind, DisruptionRiskLevel } from './types'

const BASE_RISK: Record<DisruptionKind, DisruptionRiskLevel> = {
  flight_delay: 'medium',
  flight_cancellation: 'high',
  gate_change: 'low',
  missed_connection: 'high',
  hotel_overbooking: 'high',
  late_check_in: 'medium',
  activity_cancellation: 'low',
  weather_disruption: 'high',
}

function extractDelayMinutes(text: string, fallback: number): number {
  const m = text.match(/(\d+)\s*(min|minutes|hrs?|hours|دقيقة|دقائق|ساعة|ساعات)/i)
  if (!m) return fallback
  const n = Number(m[1])
  if (!Number.isFinite(n)) return fallback
  if (/hr|hour|ساعة/.test(m[2] ?? '')) return n * 60
  return n
}

export function detectDisruptionKind(userText: string | null | undefined): DisruptionKind | null {
  const t = (userText ?? '').trim()
  if (!t) return null
  const lower = t.toLowerCase()

  if (/missed (my )?connection|فاتتني?\s*الترانزيت|أضعت\s*الاتصال/i.test(t)) return 'missed_connection'
  if (/flight (was |is )?cancel|canceled my flight|إلغاء\s*الرحلة|الرحلة\s*ألغ/i.test(t)) {
    return 'flight_cancellation'
  }
  if (/flight (is |was )?delay|my flight.*delay|delayed|تأخير\s*الرحلة|الرحلة\s*تأخر/i.test(t)) {
    return 'flight_delay'
  }
  if (/gate (was |has )?chang|new gate|تغيير\s*البوابة|البوابة\s*تغير/i.test(t)) return 'gate_change'
  if (/hotel (overbook|cancelled|canceled)|overbooked|الفندق\s*(ألغ|حجز\s*زائد)|overbook/i.test(t)) {
    return /overbook/i.test(t) ? 'hotel_overbooking' : 'hotel_overbooking'
  }
  if (/late check.?in|check.?in late|تأخرت?\s*عن\s*تسجيل/i.test(t)) return 'late_check_in'
  if (/activity (was |is )?cancel|tour cancel|إلغاء\s*النشاط|النشاط\s*ألغ/i.test(t)) {
    return 'activity_cancellation'
  }
  if (/weather|storm|fog|عاصفة|طقس|ضباب|أمطار\s*غزيرة/i.test(t)) return 'weather_disruption'
  if (/hotel.*cancel|الفندق\s*لغى|ألغى\s*الفندق/i.test(lower)) return 'hotel_overbooking'
  return null
}

export function scoreRisk(kind: DisruptionKind, delayMinutes: number): DisruptionRiskLevel {
  let risk = BASE_RISK[kind]
  if (kind === 'flight_delay') {
    if (delayMinutes >= 360) risk = 'critical'
    else if (delayMinutes >= 180) risk = 'high'
    else if (delayMinutes >= 60) risk = 'medium'
    else risk = 'low'
  }
  if (kind === 'missed_connection' && delayMinutes >= 120) risk = 'critical'
  if (kind === 'weather_disruption' && delayMinutes >= 240) risk = 'critical'
  return risk
}

export function detectLiveDisruption(userText: string | null | undefined): DetectedLiveDisruption | null {
  const kind = detectDisruptionKind(userText)
  if (!kind) return null
  const text = userText?.trim() ?? ''
  const delayFallback =
    kind === 'flight_delay' || kind === 'missed_connection' || kind === 'weather_disruption'
      ? 90
      : kind === 'late_check_in'
        ? 120
        : kind === 'gate_change'
          ? 25
          : 60
  const delayMinutes = extractDelayMinutes(text, delayFallback)
  const risk = scoreRisk(kind, delayMinutes)
  const labels: Record<DisruptionKind, { en: string; ar: string }> = {
    flight_delay: { en: `Flight delayed ~${delayMinutes} min`, ar: `تأخرت الرحلة نحو ${delayMinutes} دقيقة` },
    flight_cancellation: { en: 'Flight cancelled', ar: 'أُلغيت الرحلة' },
    gate_change: { en: 'Gate changed', ar: 'تغيرت البوابة' },
    missed_connection: { en: 'Missed connection', ar: 'فوتّ الترانزيت' },
    hotel_overbooking: { en: 'Hotel overbooking / cancellation', ar: 'حجز زائد أو إلغاء فندق' },
    late_check_in: { en: 'Late hotel check-in', ar: 'تأخر تسجيل الوصول' },
    activity_cancellation: { en: 'Activity cancelled', ar: 'أُلغي النشاط' },
    weather_disruption: { en: 'Weather disruption', ar: 'تعطل بسبب الطقس' },
  }
  return {
    id: `idr_${kind}_${Date.now().toString(36)}`,
    kind,
    summaryEn: labels[kind].en,
    summaryAr: labels[kind].ar,
    delayMinutes,
    risk,
    detectedAt: new Date().toISOString(),
    rawText: text || null,
  }
}

export function detectRecoveryIntent(userText: string | null | undefined): 'report_disruption' | 'what_now' | 'choose_recovery' | 'unknown' {
  const t = (userText ?? '').trim()
  if (!t) return 'unknown'
  if (detectDisruptionKind(t)) return 'report_disruption'
  if (/what should i do now|ماذا أفعل الآن|وش أسوي|what now/i.test(t)) return 'what_now'
  if (/cheapest recovery|fastest|premium recovery|أفضل خطة|أرخص|أسرع/i.test(t)) return 'choose_recovery'
  return 'unknown'
}
