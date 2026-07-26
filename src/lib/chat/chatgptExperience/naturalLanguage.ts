/**
 * Sprint 44 helpers — Experience Sprint 2: openings come from Conversation Brain
 * generative path (local/remote), not fixed consultant scripts.
 */

import type { ChatGptIntent, MemorySnapshot } from './types'
import { generateLocalConversation } from '../../agent/conversationBrain/localConversationModel'
import type { TravelFacts } from '../../agent/conversationBrain/travelFacts'

function factsFromMemory(input: {
  intent: ChatGptIntent
  userText: string
  locale: 'ar' | 'en'
  memory: MemorySnapshot
}): TravelFacts {
  const fromText = input.userText.match(/\b(japan|bali|paris|london|dubai|riyadh|tokyo|korea|egypt|turkey|morocco)\b/i)
  const dest = input.memory.preferences.destinations[0]
    ?? (fromText ? fromText[1]!.charAt(0).toUpperCase() + fromText[1]!.slice(1).toLowerCase() : null)
  const missing: string[] = []
  if (!dest && (input.intent === 'create_itinerary' || input.intent === 'book_flight' || input.intent === 'search_hotels')) {
    missing.push('destination')
  }
  let objective: TravelFacts['objective'] = 'general'
  if (input.intent === 'small_talk') objective = 'greet_or_continue'
  else if (input.intent === 'travel_advice') objective = 'advise'
  else if (missing.length) objective = 'collect_missing'
  else if (input.intent === 'create_itinerary' || input.intent === 'book_flight' || input.intent === 'search_hotels') {
    objective = dest ? 'greet_or_continue' : 'collect_missing'
  }

  return {
    locale: input.locale,
    objective,
    known: {
      destination: dest ?? undefined,
      destinations: dest
        ? Array.from(new Set([dest, ...input.memory.preferences.destinations]))
        : input.memory.preferences.destinations,
      budgetAmount: input.memory.preferences.budgets[0]?.amount ?? undefined,
      budgetCurrency: input.memory.preferences.budgets[0]?.currency ?? undefined,
      travelers: input.memory.preferences.companions
        ? Number(input.memory.preferences.companions) || undefined
        : undefined,
    },
    missingSlots: missing,
  }
}

export function composeNaturalReply(input: {
  intent: ChatGptIntent
  userText: string
  locale: 'ar' | 'en'
  memory: MemorySnapshot
}): { text: string; followUp: string | null } {
  const facts = factsFromMemory(input)
  const generated = generateLocalConversation({
    facts,
    userMessage: input.userText,
    conversationId: input.memory.conversationId || 'chatgpt-experience',
  })
  const followUp = smartFollowUp({
    intent: input.intent,
    locale: input.locale,
    destination: facts.known.destination ?? null,
    memory: input.memory,
  })
  const text = followUp
    ? `${generated.displayText}\n\n${followUp}`
    : generated.displayText
  return { text, followUp }
}

export function smartFollowUp(input: {
  intent: ChatGptIntent
  locale: 'ar' | 'en'
  destination: string | null
  memory: MemorySnapshot
}): string | null {
  const { locale, destination, memory } = input

  // Never re-ask known preferences.
  if (
    memory.preferences.companions
    && memory.preferences.budgets[0]?.amount != null
    && destination
  ) {
    return null
  }

  if (!memory.preferences.companions && (
    input.intent === 'create_itinerary'
    || input.intent === 'book_flight'
    || input.intent === 'search_hotels'
    || input.intent === 'general_chat'
    || input.intent === 'unknown'
    || input.intent === 'follow_up'
  )) {
    return locale === 'ar'
      ? 'هذي أقرب لسياحة، عمل، ولا عائلة؟'
      : 'Is this more for tourism, business, or family?'
  }

  if (memory.preferences.budgets[0]?.amount == null && input.intent === 'pricing') {
    return locale === 'ar'
      ? 'وش المدى اللي ترتاح له للميزانية؟'
      : 'What budget range feels comfortable?'
  }

  if (!destination && (input.intent === 'create_itinerary' || input.intent === 'book_flight')) {
    return locale === 'ar'
      ? 'وين تحس إن الرحلة لازم تكون؟'
      : 'Where do you picture this trip unfolding?'
  }

  return null
}

export function naturalToolFailureMessage(locale: 'ar' | 'en', detail?: string): string {
  if (locale === 'ar') {
    return detail
      ? `حدث تعثر بسيط (${detail}). خلّني أعيد المحاولة أو نكمّل بطريقة ثانية.`
      : 'حدث تعثر بسيط. خلّني أعيد المحاولة أو نكمّل بطريقة ثانية.'
  }
  return detail
    ? `I hit a small snag (${detail}). I can retry, or we can take another path.`
    : 'I hit a small snag. I can retry, or we can take another path.'
}
