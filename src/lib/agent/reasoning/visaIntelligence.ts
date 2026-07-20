/**
 * Sprint 49 — Visa intelligence for Saudi/GCC travelers.
 * Consultant-grade guidance — not embassy legal advice.
 */

import type { AgentLocale } from '../types'
import type { DestinationClimateProfile, VisaEase, VisaGuidance } from './types'

const VISA_META: Record<
  Exclude<VisaEase, 'unknown'>,
  { processingDays: { ar: string; en: string }; feeNote: { ar: string; en: string }; documents: { ar: string[]; en: string[] } }
> = {
  visa_free: {
    processingDays: { ar: 'فوري — جواز ساري', en: 'Immediate — valid passport' },
    feeNote: { ar: 'بدون رسوم تأشيرة', en: 'No visa fee' },
    documents: {
      ar: ['جواز سفر ساري (يفضّل 6+ أشهر)', 'تذكرة عودة أو مغادرة'],
      en: ['Valid passport (6+ months recommended)', 'Return/onward ticket'],
    },
  },
  visa_on_arrival: {
    processingDays: { ar: 'عند الوصول (دقائق)', en: 'On arrival (minutes)' },
    feeNote: { ar: 'رسوم عند الوصول — تحقق قبل السفر', en: 'Fee on arrival — confirm before travel' },
    documents: {
      ar: ['جواز سفر ساري', 'تذكرة عودة', 'إثبات إقامة أو حجز فندق'],
      en: ['Valid passport', 'Return ticket', 'Hotel booking or stay proof'],
    },
  },
  evisa: {
    processingDays: { ar: '1–5 أيام عمل (إلكتروني)', en: '1–5 business days (online)' },
    feeNote: { ar: 'تأشيرة إلكترونية — تقديم عبر الإنترنت', en: 'e-Visa — apply online' },
    documents: {
      ar: ['جواز سفر ساري', 'صورة شخصية', 'تذكرة ذهاب وعودة', 'حجز فندق أول ليلة'],
      en: ['Valid passport', 'Photo', 'Round-trip ticket', 'First-night hotel booking'],
    },
  },
  embassy: {
    processingDays: { ar: '2–4 أسابيع (موعد سفارة/مركز)', en: '2–4 weeks (embassy/VAC appointment)' },
    feeNote: { ar: 'رسوم تأشيرة + موعد مسبق', en: 'Visa fee + advance appointment' },
    documents: {
      ar: ['جواز سفر ساري', 'نموذج تأشيرة', 'صور', 'كشف حساب/إثبات مالي', 'تذاكر وحجوزات'],
      en: ['Valid passport', 'Application form', 'Photos', 'Bank statement / funds proof', 'Tickets & bookings'],
    },
  },
}

const REGION_VISA_HINTS: Record<string, { ar: string; en: string }> = {
  schengen: {
    ar: 'تأشيرة شنغن — موعد VFS/السفارة مبكراً',
    en: 'Schengen visa — book VFS/embassy slot early',
  },
  uk: {
    ar: 'تأشيرة المملكة المتحدة — تقديم عبر GOV.UK',
    en: 'UK visa — apply via GOV.UK',
  },
  canada: {
    ar: 'تأشيرة كندا — ETA أو تأشيرة زيارة حسب الجواز',
    en: 'Canada — eTA or visitor visa depending on passport',
  },
  japan: {
    ar: 'تأشيرة اليابان — موعد سفارة/مركز معتمد',
    en: 'Japan visa — embassy/VAC appointment',
  },
}

export function buildVisaGuidance(
  profile: DestinationClimateProfile,
  locale: AgentLocale,
): VisaGuidance {
  const ease = profile.visaFromSaudi
  if (ease === 'unknown') {
    return {
      ease: 'unknown',
      summary: locale === 'ar'
        ? 'تحقق من متطلبات التأشيرة قبل الحجز'
        : 'Confirm visa rules before booking',
      processingDays: null,
      documents: [],
      feeNote: null,
    }
  }

  const meta = VISA_META[ease]
  const lang = locale === 'ar' ? 'ar' : 'en'
  let summary = summaryForEase(ease, locale, profile.nameEn, profile.nameAr)

  const regionHint = regionVisaHint(profile)
  if (regionHint) {
    summary = `${summary} · ${regionHint[lang]}`
  }

  return {
    ease,
    summary,
    processingDays: meta.processingDays[lang],
    documents: meta.documents[lang],
    feeNote: meta.feeNote[lang],
  }
}

function summaryForEase(
  ease: VisaEase,
  locale: AgentLocale,
  nameEn: string,
  nameAr: string,
): string {
  const name = locale === 'ar' ? nameAr : nameEn
  if (locale === 'ar') {
    switch (ease) {
      case 'visa_free':
        return `${name}: بدون تأشيرة لحاملي الجواز السعودي (رحلات قصيرة)`
      case 'visa_on_arrival':
        return `${name}: تأشيرة عند الوصول`
      case 'evisa':
        return `${name}: تأشيرة إلكترونية قبل السفر`
      case 'embassy':
        return `${name}: تأشيرة مسبقة من السفارة`
      default:
        return `${name}: تحقق من التأشيرة`
    }
  }
  switch (ease) {
    case 'visa_free':
      return `${name}: visa-free for Saudi passports (short stays)`
    case 'visa_on_arrival':
      return `${name}: visa on arrival`
    case 'evisa':
      return `${name}: e-visa before travel`
    case 'embassy':
      return `${name}: advance embassy visa`
    default:
      return `${name}: confirm visa requirements`
  }
}

function regionVisaHint(profile: DestinationClimateProfile): { ar: string; en: string } | null {
  const risks = profile.risks.join(' ')
  if (risks.includes('schengen')) return REGION_VISA_HINTS.schengen
  if (risks.includes('uk_visa')) return REGION_VISA_HINTS.uk
  if (risks.includes('canada_visa')) return REGION_VISA_HINTS.canada
  if (profile.id === 'tokyo' || profile.id === 'sapporo' || risks.includes('japan')) {
    return REGION_VISA_HINTS.japan
  }
  return null
}
