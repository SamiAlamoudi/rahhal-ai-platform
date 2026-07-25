/**
 * Integration Sprint 9 — flexible recommendations when budget is insufficient.
 */

import type { CostBreakdown, FlexibleAlternative } from './types'

export function buildFlexibleAlternatives(input: {
  breakdown: CostBreakdown
  destination?: string | null
  currency: string
}): FlexibleAlternative[] {
  if (input.breakdown.withinBudget && input.breakdown.overBy <= 0) return []

  const over = Math.max(input.breakdown.overBy, Math.round(input.breakdown.estimatedTotal * 0.12))
  const currency = input.currency
  const dest = input.destination ?? 'your destination'

  const alternatives: FlexibleAlternative[] = [
    {
      kind: 'different_dates',
      titleEn: 'Shift dates',
      titleAr: 'تغيير التواريخ',
      estimatedSavings: Math.round(over * 0.45),
      currency,
      detailEn: 'Mid-week or shoulder dates often cut flight + hotel totals.',
      detailAr: 'أيام وسط الأسبوع أو المواسم الهادئة غالباً تخفّض الطيران والفندق.',
    },
    {
      kind: 'different_hotel',
      titleEn: 'Different hotel class',
      titleAr: 'فئة فندق مختلفة',
      estimatedSavings: Math.round(over * 0.35),
      currency,
      detailEn: 'A well-reviewed 3–4★ stay can protect location without luxury rates.',
      detailAr: 'فندق 3–4 نجوم بتقييم جيد يحافظ على الموقع دون أسعار فاخرة.',
    },
    {
      kind: 'alternative_airline',
      titleEn: 'Alternative airline',
      titleAr: 'شركة طيران بديلة',
      estimatedSavings: Math.round(over * 0.25),
      currency,
      detailEn: 'One-stop or alternate carrier may fit the remaining budget.',
      detailAr: 'توقف واحد أو ناقل بديل قد يناسب الميزانية المتبقية.',
    },
    {
      kind: 'different_airport',
      titleEn: 'Different airport',
      titleAr: 'مطار مختلف',
      estimatedSavings: Math.round(over * 0.2),
      currency,
      detailEn: `Nearby airports for ${dest} can unlock cheaper inbound fares.`,
      detailAr: `مطارات قريبة من ${dest} قد تفتح أسعاراً أرخص للوصول.`,
    },
    {
      kind: 'alternative_destination',
      titleEn: 'Alternative destination',
      titleAr: 'وجهة بديلة',
      estimatedSavings: Math.round(over * 0.55),
      currency,
      detailEn: 'A nearby city with similar vibe can restore budget headroom.',
      detailAr: 'مدينة قريبة بطابع مشابه قد تعيد هامش الميزانية.',
    },
  ]
  return alternatives.sort((a, b) => b.estimatedSavings - a.estimatedSavings)
}
