/**
 * Sprint 81 — ToolDecisionEngine (Brain v1).
 * Selects required providers/tools from intent + completeness.
 */

import type { BrainV1Intent, BrainV1MissingField, BrainV1ToolId } from './types'

export class ToolDecisionEngine {
  select(intent: BrainV1Intent, missing: BrainV1MissingField[]): BrainV1ToolId[] {
    if (missing.length > 0) return ['none']

    switch (intent) {
      case 'flight_search':
      case 'price_comparison':
      case 'price_prediction':
        return ['flights']
      case 'hotel_search':
        return ['hotels']
      case 'package_search':
      case 'family_vacation':
      case 'weekend_trip':
      case 'business_travel':
        return ['flights', 'hotels', 'packages']
      case 'multi_city_trip':
        return ['flights', 'hotels']
      case 'visa_question':
        return ['visa']
      case 'budget_planning':
        return ['budget']
      case 'travel_advice':
        return ['advice']
      case 'booking_modification':
      case 'cancellation':
        return ['none']
      default:
        return ['none']
    }
  }
}

export function createToolDecisionEngine(): ToolDecisionEngine {
  return new ToolDecisionEngine()
}
