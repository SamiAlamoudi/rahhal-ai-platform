/**
 * Sprint 85 — Response Generator.
 * Natural, friendly, short, conversational. Arabic-first, multilingual output.
 */

import type { TravelPlanSlotKey } from '../planning/types'
import type {
  ConversationConfidence,
  ConversationQuestion,
  ConversationResponse,
  ConversationSummary,
  ConversationLifecycleState,
} from './types'

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
  }): ConversationResponse {
    if (input.paused) {
      return {
        ar: 'حسناً، أوقفت التخطيط مؤقتاً. قل لي متى نكمل.',
        en: 'Okay — I paused planning. Tell me when to continue.',
        tone: 'pause',
      }
    }

    if (input.resumed) {
      const qAr = input.question?.questionAr
      const qEn = input.question?.questionEn
      return {
        ar: qAr
          ? `مرحباً بعودتك. نكمل من حيث توقفنا. ${qAr}`
          : 'مرحباً بعودتك. خطتك جاهزة تقريباً — هل نراجع الملخص؟',
        en: qEn
          ? `Welcome back — continuing where we left off. ${qEn}`
          : 'Welcome back. Your plan is almost ready — shall we review the summary?',
        tone: 'resume',
      }
    }

    if (input.topicSwitch && input.previousGoal) {
      return {
        ar: `حسناً، ننتقل لموضوع جديد. هدفك السابق (${input.previousGoal}) محفوظ إن أردت العودة له. ${input.question?.questionAr ?? 'كيف أساعدك الآن؟'}`,
        en: `Sure — switching topics. Your previous goal (${input.previousGoal}) is saved if you want to return. ${input.question?.questionEn ?? 'How can I help now?'}`,
        tone: 'revise',
      }
    }

    if (input.revisedSlots.length > 0 && input.question) {
      const changed = input.revisedSlots.join(', ')
      return {
        ar: `تم تحديث: ${changed}. ${input.question.questionAr}`,
        en: `Updated: ${changed}. ${input.question.questionEn}`,
        tone: 'revise',
      }
    }

    if (input.revisedSlots.length > 0 && !input.question) {
      const dest = input.destination ?? 'وجهتك'
      const tip = input.recommendations?.[0]
      return {
        ar: tip
          ? `حدّثت الخطة لـ${dest}. ${tip}`
          : `حدّثت الخطة لـ${dest}. صارت جاهزة للمراجعة.`,
        en: tip
          ? `I updated the plan for ${dest}. ${tip}`
          : `I updated the plan for ${dest}. It is ready to review.`,
        tone: 'revise',
      }
    }

    if (input.confidence?.needsClarification && input.question) {
      return {
        ar: `للتأكد فقط — ${input.question.questionAr}`,
        en: `Just to confirm — ${input.question.questionEn}`,
        tone: 'clarify',
      }
    }

    if (input.question) {
      const dest = input.destination
      if (dest && input.question.slot === 'dates') {
        return {
          ar: `ممتاز، ${dest} خيار جميل. ${input.question.questionAr}`,
          en: `Great — ${dest} is a lovely choice. ${input.question.questionEn}`,
          tone: 'clarify',
        }
      }
      return {
        ar: input.question.questionAr,
        en: input.question.questionEn,
        tone: 'clarify',
      }
    }

    if (input.state === 'ready' || input.state === 'summarizing') {
      const tip = input.recommendations?.[0]
      return {
        ar: tip
          ? `صارت التفاصيل كافية. ${tip} هل تريد ملخص الخطة؟`
          : 'صارت التفاصيل كافية لبدء الترتيب. هل تريد ملخصاً سريعاً؟',
        en: tip
          ? `I have enough detail. ${tip} Want a quick plan summary?`
          : 'I have enough detail to arrange options. Want a quick summary?',
        tone: 'summary',
      }
    }

    if (input.state === 'greeting' || input.state === 'idle') {
      return {
        ar: 'مرحباً! أنا رحّال. إلى أين تفكر تسافر؟',
        en: 'Hello! I am Rahhal. Where are you thinking of traveling?',
        tone: 'friendly',
      }
    }

    return {
      ar: 'أخبرني المزيد وسأكمل معك خطوة بخطوة.',
      en: 'Tell me a bit more and I will continue step by step.',
      tone: 'friendly',
    }
  }
}

export function createResponseGenerator(): ResponseGenerator {
  return new ResponseGenerator()
}
