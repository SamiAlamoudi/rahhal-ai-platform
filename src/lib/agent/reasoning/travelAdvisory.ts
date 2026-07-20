/**
 * Sprint 49 — Travel advisory intelligence (safety, season, logistics).
 * Deterministic priors — not live government feeds.
 */

import type { AgentLocale } from '../types'
import type { DestinationClimateProfile } from './types'

const RISK_COPY: Record<string, { ar: string; en: string }> = {
  schengen_visa: {
    ar: 'خطط للتأشيرة قبل حجز الطيران غير القابل للاسترداد',
    en: 'Secure visa timing before non-refundable flights',
  },
  uk_visa: {
    ar: 'تأشيرة بريطانيا تتطلب تخطيط مسبق',
    en: 'UK visa needs advance planning',
  },
  canada_visa: {
    ar: 'كندا: تحقق من ETA أو تأشيرة الزيارة',
    en: 'Canada: confirm eTA or visitor visa',
  },
  high_cost: {
    ar: 'وجهة مرتفعة التكلفة — احتفظ بهامش 15–20% في الميزانية',
    en: 'Premium destination — keep 15–20% budget buffer',
  },
  winter_cold: {
    ar: 'شتاء بارد — ملابس دافئة وإضاءة نهارية أقصر',
    en: 'Cold winter — warm layers; shorter daylight',
  },
  winter_darkness: {
    ar: 'أيام قصيرة في الشتاء — خطط للأنشطة في النهار',
    en: 'Short winter days — plan daylight activities',
  },
  summer_heat: {
    ar: 'صيف حار — تجنب الأنشطة الخارجية في منتصف النهار',
    en: 'Hot summer — avoid midday outdoor blocks',
  },
  extreme_summer_heat: {
    ar: 'حر شديد صيفاً — الأفضل شتاء أو أوائل الربيع',
    en: 'Extreme summer heat — prefer winter or early spring',
  },
  long_haul: {
    ar: 'رحلة طويلة — خذ وقت تعافٍ بعد الوصول',
    en: 'Long haul — allow recovery time after arrival',
  },
  jet_lag: {
    ar: 'فرق توقيت كبير — أول يوم خفيف',
    en: 'Significant jet lag — keep day one light',
  },
  monsoon: {
    ar: 'موسم أمطار محتمل — احتفظ بمرونة في البرنامج',
    en: 'Rainy season possible — keep itinerary flexible',
  },
  mountain_weather: {
    ar: 'طقس جبلي متقلب — احزم طبقات',
    en: 'Mountain weather shifts — pack layers',
  },
  busy_season_summer: {
    ar: 'موسم ازدحام — احجز مبكراً',
    en: 'Peak season — book early',
  },
  traffic: {
    ar: 'ازدحام مروري في المدينة — خصص وقت إضافي',
    en: 'City traffic — allow extra transfer time',
  },
  rain: {
    ar: 'أمطار متكررة — مظلة وخطة بديلة داخلية',
    en: 'Frequent rain — umbrella and indoor backup plan',
  },
  khareef_crowds: {
    ar: 'موسم الخريف في صلالة — ازدحام وحجوزات مبكرة',
    en: 'Khareef season — crowds; book ahead',
  },
  visa: {
    ar: 'تحقق من التأشيرة قبل الدفع',
    en: 'Confirm visa before paying',
  },
}

export function buildTravelAdvisory(
  profile: DestinationClimateProfile,
  locale: AgentLocale,
  options: { flightHoursFromRiyadh?: number } = {},
): string[] {
  const lang = locale === 'ar' ? 'ar' : 'en'
  const notes: string[] = []
  const seen = new Set<string>()

  for (const code of profile.risks) {
    const copy = RISK_COPY[code]
    if (copy && !seen.has(code)) {
      seen.add(code)
      notes.push(copy[lang])
    }
  }

  const hours = options.flightHoursFromRiyadh ?? profile.flightHoursFromRiyadh
  if (hours >= 10 && !seen.has('long_haul')) {
    const flightNote = locale === 'ar'
      ? `رحلة ≈ ${hours} ساعات من الرياض`
      : `≈ ${hours}h flight from Riyadh`
    notes.push(flightNote)
  }

  if (profile.region === 'Europe' && !seen.has('schengen_visa') && profile.visaFromSaudi === 'embassy') {
    notes.push(RISK_COPY.schengen_visa[lang])
  }

  return notes.slice(0, 4)
}
