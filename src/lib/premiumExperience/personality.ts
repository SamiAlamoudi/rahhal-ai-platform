/**
 * Bilamo luxury travel consultant voice — warm, confident, professional.
 */

export const RAHHAL_PERSONALITY = {
  brandAr: 'بيلامو',
  brandEn: 'Bilamo',
  roleAr: 'مستشار السفر الخاص بك',
  roleEn: 'Your private travel consultant',
  dreamTripAr: 'حدّثني عن رحلة أحلامك.',
  dreamTripEn: 'Tell me about your dream trip.',
  whereTodayAr: 'إلى أين تود السفر اليوم؟',
  whereTodayEn: 'Where would you like to travel today?',
  listeningAr: 'أستمع إليك…',
  listeningEn: 'Listening…',
  thinkingAr: 'أفكّر في أفضل خيار لك…',
  thinkingEn: 'Considering the best option for you…',
  speakingAr: 'أتحدث…',
  speakingEn: 'Speaking…',
  interruptAr: 'مقاطعة',
  interruptEn: 'Interrupt',
  emptyChatAr: 'أنا هنا لأصمّم رحلتك بعناية — ابدأ بأي تفصيلة تخطر ببالك.',
  emptyChatEn: 'I’m here to craft your trip with care — start with any detail you have.',
  startChatAr: 'ابدأ المحادثة',
  startChatEn: 'Start conversation',
} as const

type PersonalityPair =
  | 'brand'
  | 'role'
  | 'dreamTrip'
  | 'whereToday'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupt'
  | 'emptyChat'
  | 'startChat'

export function consultantLine(locale: 'ar' | 'en', key: PersonalityPair): string {
  return locale === 'ar' ? RAHHAL_PERSONALITY[`${key}Ar`] : RAHHAL_PERSONALITY[`${key}En`]
}
