/**
 * Integration Sprint 10 — recovery planner (best / cheapest / fastest / minimal / premium).
 */

import type { DetectedLiveDisruption, DisruptionImpact, RecoveryPlan, RecoveryStrategy } from './types'

const STRATEGIES: RecoveryStrategy[] = [
  'best',
  'cheapest',
  'fastest',
  'minimal_disruption',
  'premium',
]

function baseCost(kind: DetectedLiveDisruption['kind'], delay: number): number {
  switch (kind) {
    case 'flight_cancellation': return 900
    case 'missed_connection': return 750
    case 'hotel_overbooking': return 550
    case 'weather_disruption': return 650
    case 'flight_delay': return Math.min(500, 80 + Math.round(delay * 1.2))
    case 'late_check_in': return 180
    case 'activity_cancellation': return 120
    case 'gate_change': return 0
  }
}

export function planRecoveryOptions(input: {
  disruption: DetectedLiveDisruption
  impact: DisruptionImpact
  currency?: string
}): RecoveryPlan[] {
  const currency = input.currency ?? 'SAR'
  const delay = input.disruption.delayMinutes
  const base = baseCost(input.disruption.kind, delay)

  return STRATEGIES.map((strategy) => {
    let extraCost = base
    let timeSaved = Math.round(delay * 0.45)
    let residual = Math.max(0, delay - timeSaved)
    let score = 70
    let titleEn = ''
    let titleAr = ''
    let stepsEn: string[] = []
    let stepsAr: string[] = []
    let whyEn = ''
    let whyAr = ''

    switch (strategy) {
      case 'cheapest':
        extraCost = Math.round(base * 0.55)
        timeSaved = Math.round(delay * 0.25)
        residual = Math.max(0, delay - timeSaved)
        score = 78 - Math.min(20, extraCost / 50)
        titleEn = 'Cheapest recovery'
        titleAr = 'أرخص استعادة'
        stepsEn = [
          'Keep original booking where possible',
          'Use standby / next available economy seat',
          'Shift hotel check-in instead of rebooking luxury stay',
        ]
        stepsAr = [
          'أبقِ الحجز الأصلي حيث أمكن',
          'استخدم قائمة الانتظار / أقرب مقعد اقتصادي',
          'حرّك تسجيل الفندق بدل إعادة حجز فاخر',
        ]
        whyEn = 'Minimizes cash outlay while restoring a workable path.'
        whyAr = 'يقلّل التكلفة مع استعادة مسار عملي.'
        break
      case 'fastest':
        extraCost = Math.round(base * 1.25)
        timeSaved = Math.round(delay * 0.75)
        residual = Math.max(0, delay - timeSaved)
        score = 82 + Math.min(10, timeSaved / 30)
        titleEn = 'Fastest recovery'
        titleAr = 'أسرع استعادة'
        stepsEn = [
          'Rebook earliest departure (including alternate airport if needed)',
          'Pre-book transfer to hotel/meeting',
          'Notify hotel for late arrival protection',
        ]
        stepsAr = [
          'أعد الحجز لأقرب مغادرة (ومطار بديل إن لزم)',
          'احجز توصيلاً مسبقاً للفندق/الاجتماع',
          'أبلغ الفندق لحماية الوصول المتأخر',
        ]
        whyEn = 'Prioritizes time saved over cost.'
        whyAr = 'يعطي الأولوية لتوفير الوقت على التكلفة.'
        break
      case 'minimal_disruption':
        extraCost = Math.round(base * 0.8)
        timeSaved = Math.round(delay * 0.4)
        residual = Math.max(0, delay - timeSaved)
        score = 85
        titleEn = 'Minimal disruption'
        titleAr = 'أقل تعطيل'
        stepsEn = [
          'Preserve hotel and key meetings',
          'Shift only affected activities',
          'Keep same airline/alliance when possible',
        ]
        stepsAr = [
          'حافظ على الفندق والاجتماعات المهمة',
          'حرّك الأنشطة المتأثرة فقط',
          'أبقِ نفس الناقل/التحالف إن أمكن',
        ]
        whyEn = 'Protects the rest of the trip shape.'
        whyAr = 'يحمي شكل بقية الرحلة.'
        break
      case 'premium':
        extraCost = Math.round(base * 1.7) + (input.impact.overnightLikely ? 400 : 0)
        timeSaved = Math.round(delay * 0.7)
        residual = Math.max(0, delay - timeSaved)
        score = 76 + (input.impact.overnightLikely ? 6 : 0)
        titleEn = 'Premium recovery'
        titleAr = 'استعادة مميزة'
        stepsEn = [
          'Priority rebooking + lounge / flexible fare if available',
          'Guaranteed hotel relocation or late check-in',
          'Private transfer and concierge coordination',
        ]
        stepsAr = [
          'إعادة حجز بأولوية + صالة/أجرة مرنة إن توفرت',
          'نقل فندق مضمون أو تسجيل متأخر',
          'توصيل خاص وتنسيق كونسيرج',
        ]
        whyEn = 'Highest comfort and support when stress is elevated.'
        whyAr = 'أعلى راحة ودعم عندما يرتفع التوتر.'
        break
      case 'best':
      default:
        extraCost = Math.round(base * 0.95)
        timeSaved = Math.round(delay * 0.55)
        residual = Math.max(0, delay - timeSaved)
        score = 90 - Math.min(15, residual / 20)
        titleEn = 'Best recovery plan'
        titleAr = 'أفضل خطة استعادة'
        stepsEn = [
          'Rebook a reliable next flight or secure hotel alternative',
          'Auto-shift timeline, transfers, and check-in',
          'Protect meetings/activities with clear buffers',
        ]
        stepsAr = [
          'أعد حجز رحلة موثوقة تالية أو أمّن بديلاً فندقياً',
          'حرّك الجدول والتنقلات وتسجيل الوصول تلقائياً',
          'احمِ الاجتماعات/الأنشطة بهوامش واضحة',
        ]
        whyEn = 'Balances speed, cost, and trip continuity.'
        whyAr = 'يوازن بين السرعة والتكلفة واستمرارية الرحلة.'
        break
    }

    if (input.impact.budget && strategy === 'cheapest') score += 4
    if (input.impact.overnightLikely && strategy === 'premium') score += 5
    if (input.disruption.risk === 'critical' && strategy === 'fastest') score += 4

    return {
      id: `recovery-${strategy}`,
      strategy,
      titleEn,
      titleAr,
      stepsEn,
      stepsAr,
      extraCost,
      currency,
      timeSavedMinutes: timeSaved,
      residualDelayMinutes: residual,
      score: Math.max(0, Math.min(100, Math.round(score))),
      whyEn,
      whyAr,
    } satisfies RecoveryPlan
  }).sort((a, b) => b.score - a.score)
}
