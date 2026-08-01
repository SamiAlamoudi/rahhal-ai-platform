/**
 * Sprint 85/87 — Response Generator (Value Before Questions).
 * Arabic-first, consultant tone. Value → assumptions → one question.
 * Never dumps slot tables, confidence scores, or provider internals.
 */

import type { TravelPlanSlotKey } from '../planning/types'
import type {
  ConversationAssumption,
  ConversationConfidence,
  ConversationDecisionModel,
  ConversationLifecycleState,
  ConversationQuestion,
  ConversationResponse,
  ConversationSummary,
  ConversationValueItem,
} from './types'

const ROBOTIC_AR = /يرجى إدخال|الرجاء تعبئة|حدد جميع الخيارات|البيانات المطلوبة|لا يمكن المتابعة/

export class ResponseGenerator {
  generate(input: {
    locale: 'ar' | 'en'
    state: ConversationLifecycleState
    question: ConversationQuestion | null
    summary: ConversationSummary | null
    revisedSlots: TravelPlanSlotKey[]
    destination?: string | null
    confidence?: ConversationConfidence | null
    paused?: boolean
    resumed?: boolean
    topicSwitch?: boolean
    previousGoal?: string | null
    recommendations?: string[]
    valueItems?: ConversationValueItem[]
    assumptions?: ConversationAssumption[]
    decision?: ConversationDecisionModel | null
  }): ConversationResponse {
    if (input.paused) {
      return this.pack(
        'حسناً، أوقفت التخطيط مؤقتاً. قل لي متى نكمل.',
        'Okay — I paused planning. Tell me when to continue.',
        'pause',
        false,
        0,
      )
    }

    if (input.resumed) {
      const value = this.valueBlock(input.valueItems, input.assumptions, input.destination, input.revisedSlots)
      const qAr = input.question?.questionAr
      const qEn = input.question?.questionEn
      if (value.ar || qAr) {
        return this.pack(
          `مرحباً بعودتك. ${value.ar}${qAr ? ` ${qAr}` : ''}`.trim(),
          `Welcome back. ${value.en}${qEn ? ` ${qEn}` : ''}`.trim(),
          'resume',
          Boolean(value.ar),
          qAr ? 1 : 0,
        )
      }
      return this.pack(
        'مرحباً بعودتك. نكمل من حيث توقفنا.',
        'Welcome back — continuing where we left off.',
        'resume',
        false,
        0,
      )
    }

    if (input.topicSwitch && input.previousGoal) {
      return this.pack(
        `حسناً، ننتقل لموضوع جديد. هدفك السابق (${input.previousGoal}) محفوظ إن أردت العودة له. ${input.question?.questionAr ?? 'كيف أساعدك الآن؟'}`,
        `Sure — switching topics. Your previous goal (${input.previousGoal}) is saved if you want to return. ${input.question?.questionEn ?? 'How can I help now?'}`,
        'revise',
        false,
        input.question ? 1 : 0,
      )
    }

    const value = this.valueBlock(input.valueItems, input.assumptions, input.destination, input.revisedSlots)
    const hasValue = value.ar.length > 0

    if (input.revisedSlots.length > 0 && hasValue) {
      return this.pack(
        `حدّثت الأجزاء المتأثرة فقط. ${value.ar}${input.question ? ` ${input.question.questionAr}` : ''}`,
        `I updated only the affected parts. ${value.en}${input.question ? ` ${input.question.questionEn}` : ''}`,
        'revise',
        true,
        input.question ? 1 : 0,
      )
    }

    // Value-first primary path.
    if (hasValue) {
      const ar = `${value.ar}${input.question ? ` ${input.question.questionAr}` : ''}`.trim()
      const en = `${value.en}${input.question ? ` ${input.question.questionEn}` : ''}`.trim()
      return this.pack(ar, en, 'value_first', true, input.question ? 1 : 0)
    }

    // Blocking-only question (no value possible yet).
    if (input.question) {
      return this.pack(
        input.question.questionAr,
        input.question.questionEn,
        'clarify',
        false,
        1,
      )
    }

    if (input.state === 'ready' || input.state === 'summarizing') {
      const tip = input.recommendations?.[0]
      return this.pack(
        tip
          ? `صارت التفاصيل كافية. ${tip}`
          : 'صارت التفاصيل كافية لبدء الترتيب المبدئي.',
        tip
          ? `I have enough detail. ${tip}`
          : 'I have enough detail for a preliminary arrangement.',
        'summary',
        true,
        0,
      )
    }

    if (input.state === 'greeting' || input.state === 'idle') {
      return this.pack(
        'مرحباً! أنا رحّال. إلى أين تفكر تسافر؟',
        'Hello! I am Rahhal. Where are you thinking of traveling?',
        'friendly',
        false,
        1,
      )
    }

    return this.pack(
      'أخبرني المزيد وسأجهّز لك تصوراً أولياً.',
      'Tell me a bit more and I will prepare a preliminary direction.',
      'friendly',
      false,
      0,
    )
  }

  private valueBlock(
    items: ConversationValueItem[] | undefined,
    assumptions: ConversationAssumption[] | undefined,
    destination?: string | null,
    revisedSlots?: TravelPlanSlotKey[],
  ): { ar: string; en: string } {
    if (!items?.length) return { ar: '', en: '' }

    const primary = items.filter((i) => i.kind === 'destination_option' || i.kind === 'itinerary_direction')
    const estimates = items.filter((i) => i.kind === 'estimate')
    const frame = items.find((i) => i.kind === 'criteria')
    const tips = items.filter((i) => i.kind === 'tip')

    const arParts: string[] = []
    const enParts: string[] = []

    if (destination && !(revisedSlots?.length)) {
      arParts.push('اختيار ممتاز.')
      enParts.push('Excellent choice.')
    }

    // Keep consultant replies dense but bounded (Arabic Morocco path must stay concise).
    for (const item of primary.slice(0, 2)) {
      arParts.push(item.detailAr)
      enParts.push(item.detailEn)
    }

    if (frame) {
      arParts.push(frame.detailAr)
      enParts.push(frame.detailEn)
    }

    for (const item of estimates.slice(0, 2)) {
      arParts.push(item.detailAr)
      enParts.push(item.detailEn)
    }

    const assumeBitsAr: string[] = []
    const assumeBitsEn: string[] = []
    for (const a of assumptions ?? []) {
      if (a.field === 'flexibleDates' && a.assumedValue === true) {
        assumeBitsAr.push('تواريخ مرنة')
        assumeBitsEn.push('flexible dates')
      }
      if (a.field === 'budgetMode') {
        assumeBitsAr.push('ميزانية متوسطة متوازنة')
        assumeBitsEn.push('a balanced mid-range budget')
      }
      if (a.field === 'adults' && a.assumedValue === 1) {
        assumeBitsAr.push('مسافر واحد')
        assumeBitsEn.push('one adult')
      }
      if (a.field === 'hotelCategory') {
        assumeBitsAr.push('إقامة متوسطة')
        assumeBitsEn.push('mid-range stays')
      }
    }
    if (assumeBitsAr.length) {
      arParts.push(
        `أستطيع تجهيز تصور أولي الآن، وسأفترض مؤقتًا ${assumeBitsAr.join(' و')} — تقديرات مبدئية فقط ويمكنك تعديل أي افتراض لاحقًا.`,
      )
      enParts.push(
        `I can start with a preliminary plan now, temporarily assuming ${assumeBitsEn.join(' and ')} — indicative only, and you can revise any assumption later.`,
      )
    }

    for (const tip of tips.slice(0, 1)) {
      arParts.push(tip.detailAr)
      enParts.push(tip.detailEn)
    }

    let ar = arParts.join(' ')
    let en = enParts.join(' ')
    // Soft trim to keep Arabic consultant replies readable.
    if (ar.length > 620) ar = `${ar.slice(0, 617).trim()}…`
    if (en.length > 720) en = `${en.slice(0, 717).trim()}…`

    return { ar, en }
  }

  private pack(
    ar: string,
    en: string,
    tone: ConversationResponse['tone'],
    providedValue: boolean,
    questionCount: number,
  ): ConversationResponse {
    const cleanAr = ROBOTIC_AR.test(ar)
      ? ar.replace(ROBOTIC_AR, 'أستطيع المتابعة بافتراض مبدئي')
      : ar
    return {
      ar: cleanAr,
      en,
      tone,
      providedValue,
      questionCount,
    }
  }
}

export function createResponseGenerator(): ResponseGenerator {
  return new ResponseGenerator()
}
