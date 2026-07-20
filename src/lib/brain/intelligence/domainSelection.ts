/**
 * Sprint 53 — select which live domains to query (never run unnecessary providers).
 */

import type { AgentMemory } from '../../agent/types'
import type { BrainIntentResult, ConversationUnderstanding } from '../core/types'
import type { LiveDomain } from './types'

export function selectLiveDomains(input: {
  userText: string
  memory: AgentMemory
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
}): LiveDomain[] {
  const text = input.userText.toLowerCase()
  const domains = new Set<LiveDomain>()

  const hasTripContext = Boolean(
    input.memory.requirements.destination
    || input.memory.requirements.destinationFlexible
    || input.understanding.travelContext.discoveryMode
    || input.memory.tripPlan,
  )

  if (hasTripContext) {
    domains.add('weather')
    domains.add('visa')
    domains.add('safety')
    domains.add('exchange')
    domains.add('event')
  }

  if (
    /flight|airline|layover|cabin|seat|baggage|طيران|رحلة|مقعد/.test(text)
    || input.intents.primary.id === 'flight_search'
    || hasTripContext
  ) {
    domains.add('flight')
    domains.add('price_watch')
  }

  if (
    /hotel|resort|suite|فندق|إقامة/.test(text)
    || input.intents.primary.id === 'hotel_search'
    || hasTripContext
  ) {
    domains.add('hotel')
    domains.add('price_watch')
  }

  if (/visa|تأشيرة|passport|جواز/.test(text) || input.intents.primary.id === 'visa_inquiry') {
    domains.add('visa')
  }

  if (/weather|rain|snow|طقس|مطر|ثلج/.test(text)) {
    domains.add('weather')
  }

  if (/safe|advisory|risk|أمان|تحذير/.test(text)) {
    domains.add('safety')
  }

  if (/uber|taxi|metro|train|bus|transfer|أوبر|مترو|تاكسي/.test(text)) {
    domains.add('transport')
  }

  if (/price|budget|currency|exchange|سعر|ميزانية|عملة/.test(text)
    || input.intents.primary.id === 'budget_optimization') {
    domains.add('exchange')
    domains.add('price_watch')
  }

  if (/festival|holiday|conference|event|مهرجان|عطلة|مؤتمر/.test(text)) {
    domains.add('event')
  }

  // Always include transport lightly when a destination is known.
  if (input.memory.requirements.destination || input.understanding.travelContext.hasDestination) {
    domains.add('transport')
  }

  return [...domains]
}
