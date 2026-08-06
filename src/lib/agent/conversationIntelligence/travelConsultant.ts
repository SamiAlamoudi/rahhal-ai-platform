/**
 * Phase 4 — Travel Consultant voice.
 *
 * Warm, calm, knowledgeable. Not interview mode. Not generic chatbot.
 */

import type {
  ConversationIntentKind,
  LiveTravelMemory,
  ProactiveInsight,
} from './types'

function destinationLooksJapan(memory: LiveTravelMemory): boolean {
  const hay = `${memory.destination ?? ''} ${memory.cities.join(' ')}`.toLowerCase()
  return /tokyo|japan|osaka|kyoto|طوكيو|اليابان|اوساكا|كيوتو/.test(hay)
}

/**
 * Proactive insights from live memory + intent — never waits to be asked.
 */
export function buildProactiveInsights(
  memory: LiveTravelMemory,
  intent: ConversationIntentKind,
): ProactiveInsight[] {
  const tips: ProactiveInsight[] = []
  const month = (memory.monthHint ?? '').toLowerCase()

  if (destinationLooksJapan(memory) && month.includes('october')) {
    tips.push({
      id: 'tokyo_october',
      textAr:
        'أكتوبر في طوكيو رائع للتجوال. أزهار الكرز غير متاحة حينها؛ ركّز على الخريف والمعابد والطعام.',
      textEn:
        'October is excellent in Tokyo. Cherry blossoms won’t be in season — think autumn colors, temples, and food.',
    })
  } else if (month.includes('october') || month.includes('أكتوبر')) {
    tips.push({
      id: 'october_season',
      textAr: 'أكتوبر موسم ممتاز لكثير من الوجهات — أجواء معتدلة وأسعار غالباً أفضل من الذروة.',
      textEn: 'October is an excellent season for many destinations — milder weather and often better value.',
    })
  }

  if (destinationLooksJapan(memory) && (intent === 'visa_question' || memory.visaStatus == null)) {
    tips.push({
      id: 'visa_check',
      textAr: 'قد تحتاج تأشيرة حسب جنسيتك — تحقّق مبكراً قبل الحجز.',
      textEn: 'A visa may be required depending on your nationality — check early before booking.',
    })
  }

  if (destinationLooksJapan(memory) && (intent === 'local_transport' || intent === 'complete_trip')) {
    tips.push({
      id: 'jr_pass',
      textAr: 'إن كنت ستتنقل بين مدن يابانية، قد يوفّر JR Pass تكلفة القطارات.',
      textEn: 'If you will move between Japanese cities, a JR Pass may save on train costs.',
    })
  }

  if (memory.purpose === 'family') {
    tips.push({
      id: 'family_hotels',
      textAr: 'فنادق عائلية متوفرة بكثرة — أفضّل غرفاً هادئة قريبة من المواصلات.',
      textEn: 'Family-friendly hotels are widely available — quiet rooms near transit work well.',
    })
  }
  if (memory.purpose === 'honeymoon') {
    tips.push({
      id: 'honeymoon',
      textAr: 'لشهر العسل أقترح فنادق هادئة بإطلالة، وتجربة طعام مميزة.',
      textEn: 'For a honeymoon I suggest quiet hotels with a view and a memorable dining experience.',
    })
  }
  if (memory.purpose === 'business') {
    tips.push({
      id: 'business',
      textAr: 'لرحلة عمل: أقترح رحلات مباشرة قدر الإمكان وفندقاً قريباً من مركز المدينة.',
      textEn: 'For business: prefer direct flights when possible and a hotel near the city center.',
    })
  }

  return tips.slice(0, 3)
}

/**
 * Short consultant notes for soft facts / meta (Arabic-first personality).
 */
export function buildConsultantNotes(
  memory: LiveTravelMemory,
  intent: ConversationIntentKind,
  insights: ProactiveInsight[],
): string[] {
  const notes: string[] = []

  if (intent === 'emergency') {
    notes.push('أنا معك — لنرتّب الأولويات بسرعة وبهدوء.')
  } else if (memory.destination) {
    notes.push(`ممتاز — أبني لك خطة حول ${memory.destination} بثقة ووضوح.`)
  } else if (intent === 'travel_inspiration') {
    notes.push('خلّنا نبدأ من ذوقك في السفر، وأقترح عليك وجهات تناسبك.')
  } else {
    notes.push('أنا بيلامو، مستشارك للسفر. أخبرني بما يدور في بالك وسأستخرج التفاصيل بنفسي.')
  }

  for (const tip of insights) {
    notes.push(tip.textAr)
  }

  return notes.slice(0, 4)
}

export const TravelConsultant = {
  buildProactiveInsights,
  buildConsultantNotes,
}
