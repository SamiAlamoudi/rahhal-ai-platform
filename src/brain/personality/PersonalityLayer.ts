import type { LocaleCode } from '../types'

export type PersonalityTone = {
  calm: true
  confident: true
  helpful: true
  concise: true
  robotic: false
}

export type PersonalityReply = {
  text: string
  tone: PersonalityTone
  locale: LocaleCode
}

const TONE: PersonalityTone = {
  calm: true,
  confident: true,
  helpful: true,
  concise: true,
  robotic: false,
}

/**
 * Professional luxury travel consultant voice — never robotic.
 */
export class PersonalityLayer {
  readonly role = 'professional_luxury_travel_consultant' as const

  shape(input: {
    locale: LocaleCode
    intentLabel: string
    body: string
    safetyMessage?: string
  }): PersonalityReply {
    const locale = input.locale
    if (input.safetyMessage) {
      const text =
        locale === 'ar'
          ? `${input.safetyMessage} أنا هنا لأرتّب الأفضل بهدوء.`
          : `${input.safetyMessage} I am here to arrange the best path — calmly and clearly.`
      return { text, tone: TONE, locale }
    }

    const lead =
      locale === 'ar'
        ? `بكل سرور — ${input.intentLabel}.`
        : `Gladly — ${input.intentLabel}.`
    const text = `${lead} ${input.body}`.replace(/\s+/g, ' ').trim()
    return { text, tone: TONE, locale }
  }

  intentLabel(intentId: string, locale: LocaleCode): string {
    const ar: Record<string, string> = {
      book_flight: 'نرتّب الطيران',
      book_hotel: 'نختار الإقامة',
      book_package: 'نبني باقة متماسكة',
      recommendations: 'أقترح خيارات مناسبة',
      travel_advice: 'أقدّم نصيحة عملية',
      emergency: 'نتعامل مع الأمر فوراً وبهدوء',
      unknown: 'نوضح طلبك',
    }
    const en: Record<string, string> = {
      book_flight: 'let us arrange flights',
      book_hotel: 'let us select a stay',
      book_package: 'let us shape a package',
      recommendations: 'here are tailored options',
      travel_advice: 'practical guidance',
      emergency: 'we will handle this promptly and calmly',
      unknown: 'let us clarify your request',
    }
    return (locale === 'ar' ? ar : en)[intentId] ?? (locale === 'ar' ? 'نساعدك' : 'I can help')
  }
}
