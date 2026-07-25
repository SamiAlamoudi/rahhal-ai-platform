/**
 * Integration Sprint 7 — Emergency support framework (no live integrations).
 */

import type { CompanionEmergencyKind, CompanionEmergencySupport } from './types'

const FRAMEWORK: Record<CompanionEmergencyKind, Omit<CompanionEmergencySupport, 'kind' | 'liveIntegration'>> = {
  lost_passport: {
    titleEn: 'Lost passport',
    titleAr: 'فقدان جواز السفر',
    stepsEn: [
      'File a local police report if required.',
      'Contact your embassy / consulate for emergency travel documents.',
      'Notify your airline and hotel with the incident reference.',
    ],
    stepsAr: [
      'حرّر بلاغاً لدى الشرطة إن لزم.',
      'تواصل مع السفارة/القنصلية لوثيقة سفر طارئة.',
      'أبلغ شركة الطيران والفندق برقم البلاغ.',
    ],
    contactsEn: ['Local police', 'Embassy duty phone (lookup later)', 'Airline desk'],
    contactsAr: ['الشرطة المحلية', 'هاتف مناوبة السفارة (لاحقاً)', 'مكتب شركة الطيران'],
  },
  medical_help: {
    titleEn: 'Medical help',
    titleAr: 'مساعدة طبية',
    stepsEn: [
      'Call local emergency services for urgent care.',
      'Share your hotel address and language needs.',
      'Keep travel insurance policy numbers handy.',
    ],
    stepsAr: [
      'اتصل بالطوارئ المحلية للحالات العاجلة.',
      'شارك عنوان الفندق واحتياج اللغة.',
      'أبقِ أرقام وثيقة التأمين جاهزة.',
    ],
    contactsEn: ['Local emergency number', 'Hotel front desk', 'Travel insurance hotline'],
    contactsAr: ['رقم الطوارئ المحلي', 'استقبال الفندق', 'خط التأمين السفر'],
  },
  emergency_numbers: {
    titleEn: 'Emergency numbers',
    titleAr: 'أرقام الطوارئ',
    stepsEn: [
      'Save police / ambulance / fire numbers for the current city.',
      'Ask hotel reception for the nearest clinic.',
    ],
    stepsAr: [
      'احفظ أرقام الشرطة/الإسعاف/الإطفاء لمدينتك الحالية.',
      'اسأل الاستقبال عن أقرب عيادة.',
    ],
    contactsEn: ['Police', 'Ambulance', 'Fire'],
    contactsAr: ['الشرطة', 'الإسعاف', 'الإطفاء'],
  },
  embassy_lookup: {
    titleEn: 'Embassy lookup',
    titleAr: 'البحث عن السفارة',
    stepsEn: [
      'Identify your nationality and current city.',
      'Use official government directories when live lookup is enabled.',
      'Ask hotel concierge for the nearest consulate address.',
    ],
    stepsAr: [
      'حدّد جنسيتك ومدينتك الحالية.',
      'استخدم الأدلة الحكومية الرسمية عند تفعيل البحث المباشر.',
      'اسأل الكونسيرج عن أقرب قنصلية.',
    ],
    contactsEn: ['Embassy directory (future)', 'Hotel concierge'],
    contactsAr: ['دليل السفارات (لاحقاً)', 'كونسيرج الفندق'],
  },
  safe_transport: {
    titleEn: 'Safe transport',
    titleAr: 'تنقل آمن',
    stepsEn: [
      'Prefer official taxis or known ride-hailing apps.',
      'Share live trip status with a trusted contact when available.',
      'Avoid unmarked vehicles at night.',
    ],
    stepsAr: [
      'فضّل التاكسي الرسمي أو تطبيقات معروفة.',
      'شارك حالة رحلتك مع شخص موثوق عند التوفر.',
      'تجنب المركبات غير المميزة ليلاً.',
    ],
    contactsEn: ['Hotel transfer desk', 'Official taxi stand'],
    contactsAr: ['مكتب توصيل الفندق', 'موقف تاكسي رسمي'],
  },
}

export function detectEmergencyKind(userText: string | null | undefined): CompanionEmergencyKind | null {
  const t = (userText ?? '').toLowerCase()
  if (!t) return null
  if (/lost\s+(my\s+)?passport|passport\s+(is\s+)?lost|جواز.*(ضائع|مفقود)|فقدت\s*جواز/.test(t)) {
    return 'lost_passport'
  }
  if (/medical|hospital|مستشفى|طبيب|ambulance|إسعاف/.test(t)) return 'medical_help'
  if (/embassy|سفارة|قنصلية|consulate/.test(t)) return 'embassy_lookup'
  if (/emergency number|رقم الطوارئ|emergency contacts/.test(t)) return 'emergency_numbers'
  if (/safe transport|تاكسي آمن|safe taxi|تنقل آمن/.test(t)) return 'safe_transport'
  if (/emergency|طوارئ/.test(t)) return 'emergency_numbers'
  return null
}

export function buildEmergencySupport(kind: CompanionEmergencyKind): CompanionEmergencySupport {
  return {
    kind,
    liveIntegration: false,
    ...FRAMEWORK[kind],
  }
}
