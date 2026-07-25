/**
 * Integration Sprint 7 — Travel assistant intents from trip context.
 */

import type {
  CompanionAssistantIntent,
  CompanionLocationLayer,
  TravelTimelineSnapshot,
  TripCompanionContextMemory,
  TripSession,
} from './types'
import { detectEmergencyKind } from './emergency'

export function detectCompanionAssistantIntent(userText: string | null | undefined): CompanionAssistantIntent {
  const t = (userText ?? '').trim()
  if (!t) return 'unknown'
  if (detectEmergencyKind(t)) return 'emergency'
  if (/what should i do now|ماذا أفعل الآن|وش أسوي الآن|what now/i.test(t)) return 'what_now'
  if (/when should i leave|متى أغادر|متى أطلع|leave for (the )?airport/i.test(t)) return 'when_leave'
  if (/am i late|هل أنا متأخر|متأخر\??|running late/i.test(t)) return 'am_i_late'
  if (/suggest something nearby|nearby|قريب مني|اقترح .*قريب/i.test(t)) return 'nearby'
  if (/trip status|حالة الرحلة|where am i in (the )?trip|جلسة الرحلة/i.test(t)) return 'status'
  return 'unknown'
}

export function isCompanionAssistantAsk(userText: string | null | undefined): boolean {
  const intent = detectCompanionAssistantIntent(userText)
  return intent !== 'unknown'
}

export function answerCompanionAssistant(input: {
  intent: CompanionAssistantIntent
  session: TripSession | null
  timeline: TravelTimelineSnapshot | null
  context: TripCompanionContextMemory | null
  location: CompanionLocationLayer | null
  locale: 'ar' | 'en'
}): { en: string; ar: string } {
  const next = input.timeline?.next
  const current = input.timeline?.current
  const late = input.timeline?.late[0]
  const city = input.context?.currentCity ?? input.location?.city?.labelEn ?? 'your city'
  const hotel = input.context?.currentHotel ?? input.location?.hotel?.labelEn

  switch (input.intent) {
    case 'what_now': {
      if (current) {
        return {
          en: `Right now: ${current.titleEn}${current.locationLabel ? ` at ${current.locationLabel}` : ''}. Next up: ${next?.titleEn ?? 'a flexible buffer'}.`,
          ar: `الآن: ${current.titleAr}${current.locationLabel ? ` في ${current.locationLabel}` : ''}. التالي: ${next?.titleAr ?? 'وقت مرن'}.`,
        }
      }
      if (next) {
        return {
          en: `Focus on what’s next: ${next.titleEn}${next.remainingMinutes != null ? ` in ~${next.remainingMinutes} min` : ''}.`,
          ar: `ركّز على التالي: ${next.titleAr}${next.remainingMinutes != null ? ` خلال نحو ${next.remainingMinutes} دقيقة` : ''}.`,
        }
      }
      return {
        en: `You’re in ${input.session?.state ?? 'upcoming'} — enjoy ${city}${hotel ? ` near ${hotel}` : ''}.`,
        ar: `أنت في حالة ${input.session?.state ?? 'upcoming'} — استمتع بـ ${city}${hotel ? ` قرب ${hotel}` : ''}.`,
      }
    }
    case 'when_leave': {
      const flight = input.timeline?.upcoming.find((e) => e.kind === 'flight')
        ?? input.timeline?.next
      if (!flight) {
        return {
          en: 'I don’t see a timed departure yet — share your flight time and I’ll compute when to leave.',
          ar: 'لا أرى موعد مغادرة بعد — شارك وقت الرحلة وأحسب متى تغادر.',
        }
      }
      const leaveMins = Math.max(90, (flight.remainingMinutes ?? 180) - 0)
      // Recommend leaving 3h before flight when remaining known
      const recommend = flight.remainingMinutes != null
        ? Math.max(flight.remainingMinutes - 180, 0)
        : null
      return {
        en: recommend != null
          ? `For ${flight.titleEn}, leave in ~${recommend} minutes (aim for ~3 hours before departure).`
          : `For ${flight.titleEn}, plan about 3 hours before departure (${leaveMins} min buffer style).`,
        ar: recommend != null
          ? `لـ ${flight.titleAr}، غادر خلال نحو ${recommend} دقيقة (هدف ~3 ساعات قبل الإقلاع).`
          : `لـ ${flight.titleAr}، خطّط لنحو 3 ساعات قبل الإقلاع.`,
      }
    }
    case 'am_i_late': {
      if (late) {
        return {
          en: `Yes — you’re cutting it close for ${late.titleEn}. Leave now if you still need transit.`,
          ar: `نعم — الوقت ضيق لـ ${late.titleAr}. غادر الآن إن كنت تحتاج تنقلاً.`,
        }
      }
      if (input.timeline?.missed.length) {
        return {
          en: `You missed ${input.timeline.missed[0]!.titleEn}. I can rebuild the rest of today.`,
          ar: `فاتك ${input.timeline.missed[0]!.titleAr}. أستطيع إعادة بناء بقية اليوم.`,
        }
      }
      if (next?.remainingMinutes != null && next.remainingMinutes <= 20) {
        return {
          en: `Almost — ${next.titleEn} starts in ~${next.remainingMinutes} min.`,
          ar: `تقريباً — ${next.titleAr} يبدأ خلال نحو ${next.remainingMinutes} دقيقة.`,
        }
      }
      return {
        en: 'You’re on time for the next item on your timeline.',
        ar: 'أنت في الوقت المناسب للبند التالي في جدولك.',
      }
    }
    case 'nearby': {
      return {
        en: hotel
          ? `Maps aren’t live yet — from ${hotel} in ${city}, I’d keep a short walk: café, viewpoint, or a calm park. Tell me your mood (food / quiet / culture).`
          : `Maps aren’t live yet — in ${city}, share whether you want food, culture, or a short walk and I’ll suggest from the plan.`,
        ar: hotel
          ? `الخرائط ليست مباشرة بعد — من ${hotel} في ${city} أقترح مشياً قصيراً: مقهى أو إطلالة أو حديقة هادئة. أخبرني بمزاجك (طعام/هدوء/ثقافة).`
          : `الخرائط ليست مباشرة بعد — في ${city} أخبرني إن أردت طعاماً أو ثقافة أو مشياً قصيراً وسأقترح من الخطة.`,
      }
    }
    case 'status': {
      return {
        en: `Trip session: ${input.session?.state ?? 'upcoming'} · ${input.context?.todaysPlanSummaryEn ?? 'No plan summary'}.`,
        ar: `جلسة الرحلة: ${input.session?.state ?? 'upcoming'} · ${input.context?.todaysPlanSummaryAr ?? 'لا ملخص بعد'}.`,
      }
    }
    case 'emergency':
      return {
        en: 'I can walk you through emergency steps (passport, medical, embassy). Live integrations are not enabled yet.',
        ar: 'أستطيع توجيهك بخطوات الطوارئ (جواز، طبي، سفارة). التكاملات المباشرة غير مفعّلة بعد.',
      }
    default:
      return {
        en: 'Ask me what to do now, when to leave, if you’re late, or for something nearby.',
        ar: 'اسألني ماذا تفعل الآن، متى تغادر، هل أنت متأخر، أو اقترح شيئاً قريباً.',
      }
  }
}
