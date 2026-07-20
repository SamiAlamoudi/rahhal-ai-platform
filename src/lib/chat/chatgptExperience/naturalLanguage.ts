/**
 * Sprint 44 — natural conversation helpers + smart follow-ups.
 * Prefer natural wording; ask follow-ups only when they improve the turn.
 */

import type { ChatGptIntent, MemorySnapshot } from './types'

export function composeNaturalReply(input: {
  intent: ChatGptIntent
  userText: string
  locale: 'ar' | 'en'
  memory: MemorySnapshot
}): { text: string; followUp: string | null } {
  const locale = input.locale
  const dest = input.memory.preferences.destinations[0] ?? extractDestination(input.userText)

  if (input.intent === 'small_talk') {
    return {
      text:
        locale === 'ar'
          ? 'أهلاً بك. أنا معك — خبرني عن الرحلة اللي في بالك.'
          : 'Hi — I am right here with you. Tell me about the trip you have in mind.',
      followUp: null,
    }
  }

  if (input.intent === 'travel_advice') {
    const base =
      locale === 'ar'
        ? dest
          ? `${dest} اختيار جميل. خلّني أعطيك نصيحة عملية تناسب أسلوب سفرك.`
          : 'أكيد — أحب أساعدك بنصيحة عملية وواضحة.'
        : dest
          ? `${dest} is a lovely pick. I can share practical advice that fits how you like to travel.`
          : 'Absolutely — I can share practical advice in plain language.'
    return {
      text: base,
      followUp: smartFollowUp({ intent: input.intent, locale, destination: dest, memory: input.memory }),
    }
  }

  if (input.intent === 'general_chat' || input.intent === 'unknown') {
    return {
      text:
        locale === 'ar'
          ? 'فاهم عليك. خلّنا نكمّل بهدوء — خبرني أكثر.'
          : 'Got it. Let’s take this gently — tell me a little more.',
      followUp: smartFollowUp({
        intent: input.intent,
        locale,
        destination: dest,
        memory: input.memory,
      }),
    }
  }

  if (input.intent === 'create_itinerary' || input.intent === 'book_flight' || input.intent === 'search_hotels') {
    const opener =
      locale === 'ar'
        ? dest
          ? `اختيار رائع — ${dest}. عندي أفكار أولية وسأقارن أفضل الخيارات.`
          : 'تمام. عندي أفكار أولية — خلّني أضبطها على طلبك.'
        : dest
          ? `Great choice — ${dest}. I already have a few ideas; let me compare the best options.`
          : 'Sounds good. I already have a few ideas — let me shape them around what you need.'
    return {
      text: opener,
      followUp: smartFollowUp({
        intent: input.intent,
        locale,
        destination: dest,
        memory: input.memory,
      }),
    }
  }

  return {
    text:
      locale === 'ar'
        ? 'فاهم. خلّني أكمّل من حيث توقفنا.'
        : 'Understood. I will continue from where we left off.',
    followUp: null,
  }
}

export function smartFollowUp(input: {
  intent: ChatGptIntent
  locale: 'ar' | 'en'
  destination: string | null
  memory: MemorySnapshot
}): string | null {
  const { locale, destination, memory } = input

  // Don't re-ask what memory already knows.
  if (
    memory.preferences.companions
    && memory.preferences.budgets[0]?.amount != null
    && destination
  ) {
    return null
  }

  if (input.intent === 'create_itinerary' || input.intent === 'book_flight' || input.intent === 'search_hotels') {
    if (destination && !memory.preferences.companions) {
      return locale === 'ar'
        ? `اختيار ممتاز.\nهل تخطط لهذه الرحلة للسياحة، للعمل، أم مع العائلة؟`
        : `Great choice.\nAre you planning this trip for tourism, business, or family?`
    }
    if (!destination) {
      return locale === 'ar'
        ? 'إلى أين تفكر تسافر؟'
        : 'Where are you thinking of going?'
    }
  }

  if (input.intent === 'visa_question' && !memory.preferences.destinations.length) {
    return locale === 'ar'
      ? 'لأي وجهة تريد معرفة متطلبات التأشيرة؟'
      : 'Which destination should I check visa requirements for?'
  }

  return null
}

export function naturalToolFailureMessage(locale: 'ar' | 'en', detail?: string): string {
  if (locale === 'ar') {
    return detail
      ? `واجهت مشكلة بسيطة أثناء جلب المعلومات (${detail}). نقدر نكمّل المحادثة وأعيد المحاولة بطريقة أخرى.`
      : 'واجهت مشكلة بسيطة أثناء جلب المعلومات. نقدر نكمّل المحادثة وأعيد المحاولة بطريقة أخرى.'
  }
  return detail
    ? `I hit a small snag while fetching that (${detail}). We can keep talking — I’ll try another way.`
    : 'I hit a small snag while fetching that. We can keep talking — I’ll try another way.'
}

function extractDestination(text: string): string | null {
  const m =
    text.match(/(?:travel to|trip to|visit|go to|إلى|الى)\s+([A-Za-z\u0600-\u06FF][\w\s\u0600-\u06FF]{1,40})/i)
  if (m?.[1]) return m[1].replace(/[?.!,،].*$/, '').trim()
  const known = ['japan', 'tokyo', 'morocco', 'dubai', 'paris', 'london', 'istanbul', 'egypt', 'bali']
  const lower = text.toLowerCase()
  for (const name of known) {
    if (lower.includes(name)) return name[0]!.toUpperCase() + name.slice(1)
  }
  return null
}
