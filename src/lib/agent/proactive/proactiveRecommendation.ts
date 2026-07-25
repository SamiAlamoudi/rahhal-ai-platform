/**
 * Phase 3 Stage 3 — Build proactive recommendation objects.
 * Template copy only — never invents visas, prices, or weather facts.
 */

import { scoreProactiveConfidence } from './proactiveConfidence'
import { computeProactivePriority } from './proactivePriority'
import type {
  ProactiveContextBag,
  ProactiveDetectedSignal,
  ProactiveKnowledgeRef,
  ProactiveMemoryAppend,
  ProactiveRecommendation,
  ProactiveVoiceHint,
} from './types'

let seq = 0
function nextId(signal: string): string {
  seq += 1
  return `proactive-${signal}-${seq}`
}

export function buildProactiveRecommendation(input: {
  detected: ProactiveDetectedSignal
  context: ProactiveContextBag
}): ProactiveRecommendation {
  const scored = scoreProactiveConfidence({
    detected: input.detected,
    context: input.context,
  })
  const locale = input.context.locale
  const copy = renderCopy(input.detected, input.context)
  const priority = computeProactivePriority({
    signal: input.detected.signal,
    confidence: scored.confidence,
    clarificationRequired: scored.clarificationRequired,
  })

  const voiceHint: ProactiveVoiceHint = {
    speakableSummary: copy.spoken,
    locale,
    urgency: scored.confidence >= 0.65 ? 'medium' : 'low',
  }

  const knowledgeRefs: ProactiveKnowledgeRef[] = [
    {
      entryId: `kc:${input.detected.signal}`,
      topic: input.detected.signal,
      optional: true,
    },
  ]

  const memoryAppend: ProactiveMemoryAppend[] = [
    {
      key: `proactive_signal:${input.detected.signal}`,
      value: 'surfaced',
      mode: 'append',
    },
  ]
  if (input.context.hasFamilySignal && input.detected.signal === 'family_travel') {
    memoryAppend.push({
      key: 'preference:family_travel',
      value: 'noted',
      mode: 'append',
    })
  }
  if (input.context.hasBusinessSignal && input.detected.signal === 'executive_travel') {
    memoryAppend.push({
      key: 'preference:business_travel',
      value: 'noted',
      mode: 'append',
    })
  }

  return {
    id: nextId(input.detected.signal),
    signal: input.detected.signal,
    title: copy.title,
    message: copy.message,
    reason: input.detected.reason,
    confidence: scored.confidence,
    supportingEvidence: [...input.detected.supportingEvidence],
    missingEvidence: [...scored.missingEvidence],
    clarificationRequired: scored.clarificationRequired,
    priority,
    voiceHint,
    knowledgeRefs,
    memoryAppend,
  }
}

function renderCopy(
  detected: ProactiveDetectedSignal,
  context: ProactiveContextBag,
): { title: string; message: string; spoken: string } {
  const ar = context.locale === 'ar'
  const dest = context.destination
  const destLabel = dest ?? (ar ? 'وجهتك' : 'your destination')

  switch (detected.signal) {
    case 'visa_reminder':
      return {
        title: ar ? 'تذكير بالتأشيرة' : 'Visa reminder',
        message: ar
          ? `بما أنك تفكر في ${destLabel}، يجدر التحقق من متطلبات التأشيرة حسب جنسيتك — دون افتراض حالة الدخول.`
          : `Since you’re considering ${destLabel}, it’s worth checking visa entry rules for your nationality — without assuming approval.`,
        spoken: ar ? 'تحقق من متطلبات التأشيرة لوجهتك.' : 'Check visa requirements for your destination.',
      }
    case 'weather_notice':
      return {
        title: ar ? 'ملاحظة عن الطقس' : 'Weather notice',
        message: ar
          ? 'مع وجود توقيت للسفر، راجع توقعات الطقس العامة للموسم قبل حزم الأمتعة أو حجز أنشطة خارجية.'
          : 'With timing in mind, review typical seasonal weather before packing or booking outdoor activities.',
        spoken: ar ? 'راجع توقعات الطقس للموسم.' : 'Review seasonal weather expectations.',
      }
    case 'budget_optimization':
      return {
        title: ar ? 'فرصة لتوفير الميزانية' : 'Budget saving opportunity',
        message: ar
          ? 'ذكرت ميزانية — يمكن استكشاف مرونة التواريخ أو فئة الإقامة لتوفير التكلفة دون تغيير الوجهة.'
          : 'You mentioned a budget — flexible dates or lodging class can sometimes reduce cost without changing destination.',
        spoken: ar ? 'قد توجد فرص لتوفير الميزانية.' : 'There may be budget-saving opportunities.',
      }
    case 'family_travel':
      return {
        title: ar ? 'اقتراحات سفر عائلي' : 'Family travel suggestions',
        message: ar
          ? 'يبدو أن الرحلة عائلية — فنادق مناسبة للعائلات وتنقل مريح غالباً ما يسهّلان التجربة.'
          : 'This looks like a family trip — family-friendly hotels and easier transfers often help.',
        spoken: ar ? 'فكر في خيارات مناسبة للعائلات.' : 'Consider family-friendly options.',
      }
    case 'executive_travel':
      return {
        title: ar ? 'اقتراحات سفر عمل' : 'Executive travel suggestions',
        message: ar
          ? 'لرحلات العمل: صالات المطارات، بروتوكول الوصول، ونقل موثوق غالباً ما توفر وقتاً ثميناً.'
          : 'For business travel: lounges, arrival protocol, and reliable transfers often protect scarce time.',
        spoken: ar ? 'راجع ترتيبات سفر العمل.' : 'Review executive travel logistics.',
      }
    case 'meeting_logistics':
      return {
        title: ar ? 'لوجستيات الاجتماعات' : 'Meeting logistics',
        message: ar
          ? 'أضف هامش وقت بين الرحلات والاجتماعات لتقليل مخاطر التأخير.'
          : 'Leave buffer time between flights and meetings to reduce delay risk.',
        spoken: ar ? 'اترك هامشاً للاجتماعات.' : 'Leave buffer time for meetings.',
      }
    case 'currency_reminder':
      return {
        title: ar ? 'تذكير بالعملة' : 'Currency reminder',
        message: ar
          ? `تحقق من عملة ${destLabel} وخيارات الدفع الشائعة قبل المغادرة.`
          : `Confirm local currency and common payment options for ${destLabel} before departure.`,
        spoken: ar ? 'تحقق من العملة المحلية.' : 'Confirm local currency options.',
      }
    case 'esim_suggestion':
      return {
        title: ar ? 'اقتراح eSIM/شريحة' : 'eSIM / SIM suggestion',
        message: ar
          ? 'الاتصال عند الوصول يسهّل التنقل — تحقق من خيارات eSIM أو الشريحة المحلية لاحقاً.'
          : 'Connectivity on arrival helps with transfers — consider eSIM or a local SIM later.',
        spoken: ar ? 'فكر في eSIM للوصول.' : 'Consider an eSIM for arrival.',
      }
    case 'accessibility':
      return {
        title: ar ? 'اقتراحات الوصولية' : 'Accessibility suggestions',
        message: ar
          ? 'بما أن الوصولية مهمة لديك، يُفضّل التحقق من الفنادق والتنقل والمطارات مسبقاً.'
          : 'Since accessibility matters here, verify hotels, transfers, and airports in advance.',
        spoken: ar ? 'تحقق من ترتيبات الوصولية.' : 'Verify accessibility arrangements.',
      }
    case 'travel_insurance_reminder':
      return {
        title: ar ? 'تذكير بتأمين السفر' : 'Travel insurance reminder',
        message: ar
          ? 'تأمين السفر خطوة وقائية شائعة — راجع التغطية المناسبة لطول رحلتك لاحقاً.'
          : 'Travel insurance is a common protective step — review coverage suited to your trip length later.',
        spoken: ar ? 'فكر في تأمين السفر.' : 'Consider travel insurance.',
      }
    default:
      return {
        title: ar ? 'تنبيه استباقي' : 'Proactive tip',
        message: detected.reason,
        spoken: detected.reason.slice(0, 120),
      }
  }
}

export function buildProactiveRecommendations(input: {
  detected: ProactiveDetectedSignal[]
  context: ProactiveContextBag
}): ProactiveRecommendation[] {
  return input.detected.map((d) =>
    buildProactiveRecommendation({ detected: d, context: input.context }),
  )
}

export const ProactiveRecommendationBuilder = {
  build: buildProactiveRecommendation,
  buildAll: buildProactiveRecommendations,
}
