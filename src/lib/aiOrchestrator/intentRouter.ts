/**
 * Sprint 43 — intelligent tool routing.
 * Maps user utterances to logical tools; never implements engine business logic.
 */

import type { OrchestratorIntent, OrchestratorToolId } from './types'

export type IntentRouteResult = {
  intent: OrchestratorIntent
  tools: OrchestratorToolId[]
  confidence: number
  reason: string
}

/**
 * Route a user utterance to one or more tools.
 * Examples from Sprint 43:
 * - Morocco travel → destination, flights, hotels, visa, insurance, activities
 * - cheapest → supplier marketplace, loyalty, finance, refund policy
 * - flight cancelled → disruption, refund, loyalty, timeline, supplier search
 * - lost passport → travel documents, visa, timeline, notifications
 */
export function routeUserIntent(userText: string, commandHint?: string | null): IntentRouteResult {
  const text = userText.trim()
  const lower = text.toLowerCase()

  if (isLostPassport(lower)) {
    return {
      intent: 'lost_passport',
      tools: ['travel_documents', 'visa', 'timeline', 'notifications'],
      confidence: 0.95,
      reason: 'Lost passport / document emergency routing',
    }
  }

  if (isFlightCancelled(lower, commandHint)) {
    return {
      intent: 'flight_cancelled',
      tools: ['disruption', 'refund_policy', 'loyalty', 'timeline', 'supplier_marketplace'],
      confidence: 0.94,
      reason: 'Flight cancellation multi-engine recovery routing',
    }
  }

  if (isCheapest(lower, commandHint)) {
    return {
      intent: 'cheapest_option',
      tools: ['supplier_marketplace', 'loyalty', 'finance', 'refund_policy'],
      confidence: 0.9,
      reason: 'Price-optimized option routing',
    }
  }

  if (isDestinationTravel(lower, commandHint)) {
    return {
      intent: 'destination_travel',
      tools: ['destination', 'flights', 'hotels', 'visa', 'insurance', 'activities'],
      confidence: 0.92,
      reason: 'Destination travel discovery routing',
    }
  }

  const single = mapSingleTool(lower, commandHint)
  if (single) {
    return {
      intent: 'single_tool',
      tools: [single],
      confidence: 0.85,
      reason: `Single-tool route: ${single}`,
    }
  }

  if (/plan|trip|itinerary|book|travel|رحلة|خطة|احجز/.test(lower)) {
    return {
      intent: 'general_plan',
      tools: ['ai_conversation', 'flights', 'hotels', 'booking'],
      confidence: 0.7,
      reason: 'General trip planning via conversation + search tools',
    }
  }

  return {
    intent: 'fallback',
    tools: ['ai_conversation'],
    confidence: 0.4,
    reason: 'Fallback to conversational planner',
  }
}

export function shouldUseOrchestratorForRoute(route: IntentRouteResult): boolean {
  if (route.intent === 'fallback' && route.tools.length <= 1) return false
  if (route.intent === 'single_tool') return false
  return (
    route.intent === 'destination_travel'
    || route.intent === 'cheapest_option'
    || route.intent === 'flight_cancelled'
    || route.intent === 'lost_passport'
    || route.intent === 'general_plan'
    || route.tools.length > 1
  )
}

function isLostPassport(lower: string): boolean {
  return (
    /lost (my )?passport|passport (was |is )?stolen|missing passport|passport gone/.test(lower)
    || /فقدت جواز|ضاعت جواز|جواز السفر/.test(lower) && /فقد|ضاع|stolen|lost/.test(lower)
  )
}

function isFlightCancelled(lower: string, commandHint?: string | null): boolean {
  if (commandHint === 'flight_cancelled') return true
  return (
    /my flight (was |is )?cancelled|flight (was |is )?cancelled|canceled my flight/.test(lower)
    || /ألغيت رحلتي|تم إلغاء رحلتي|إلغاء الرحلة/.test(lower)
  )
}

function isCheapest(lower: string, commandHint?: string | null): boolean {
  if (commandHint === 'make_cheaper') return true
  return (
    /cheapest option|cheapest|lowest price|best price|most affordable|budget option/.test(lower)
    || /أرخص|الأرخص|أقل سعر/.test(lower)
  )
}

function isDestinationTravel(lower: string, commandHint?: string | null): boolean {
  if (commandHint === 'plan' && /travel to|visit|go to|trip to|morocco|tokyo|paris|dubai|japan|london/.test(lower)) {
    return true
  }
  return (
    /i want to travel to|travel to [a-z]|want to visit|trip to [a-z]|going to [a-z]/.test(lower)
    || /أريد السفر إلى|أسافر إلى|رحلة إلى/.test(lower)
  )
}

function mapSingleTool(lower: string, commandHint?: string | null): OrchestratorToolId | null {
  if (commandHint === 'pay_now') return 'payments'
  if (commandHint?.startsWith('finance_')) return 'finance'
  if (
    commandHint === 'trusted_suppliers_only'
    || commandHint === 'premium_hotel_providers'
    || commandHint === 'avoid_poor_refunds'
    || commandHint === 'fastest_confirmation'
    || commandHint === 'rank_suppliers'
  ) {
    return 'supplier_marketplace'
  }
  if (
    commandHint === 'can_travel_to'
    || commandHint === 'need_visa'
    || commandHint === 'passport_expiry'
    || commandHint === 'transit_visa'
    || commandHint === 'what_documents'
    || commandHint === 'vaccination_requirements'
  ) {
    return 'travel_documents'
  }
  if (
    commandHint === 'use_bilamo_points'
    || commandHint === 'most_rewards_hotel'
    || commandHint === 'upgrade_with_points'
    || commandHint === 'points_earn_estimate'
    || commandHint === 'wallet_balance'
    || commandHint === 'membership_benefits'
  ) {
    return 'loyalty'
  }
  if (
    commandHint === 'cancel_refund_quote'
    || commandHint === 'cancel_hotel_only'
    || commandHint === 'flight_delay_policy'
    || commandHint === 'deposit_refund'
    || commandHint === 'cancel_after_checkin'
    || commandHint === 'airline_cancels'
    || commandHint === 'one_traveler_cancels'
  ) {
    return 'refund_policy'
  }
  if (
    commandHint === 'flight_delayed'
    || commandHint === 'missed_connection'
    || commandHint === 'hotel_cancelled'
  ) {
    return 'disruption'
  }
  if (
    commandHint === 'my_trip'
    || commandHint === 'show_itinerary'
    || commandHint === 'any_delays'
  ) {
    return 'timeline'
  }

  if (/visa|تأشيرة|فيزا/.test(lower)) return 'visa'
  if (/insurance|تأمين/.test(lower)) return 'insurance'
  if (/loyalty|points|نقاط/.test(lower)) return 'loyalty'
  if (/refund|cancel|استرداد|إلغاء/.test(lower)) return 'refund_policy'
  if (/supplier|مورد/.test(lower)) return 'supplier_marketplace'
  return null
}
