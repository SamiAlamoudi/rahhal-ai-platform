/**
 * Sprint 27 — extract travel intent from conversation (reuses IntentClassifier).
 */

import { IntentClassifier } from '../intentClassifier'
import type { BrainLocale, IntentClassification, TravelIntent } from '../types'
import type { OrchestratorDomain } from './types'

/**
 * Conversation-first intent extraction — no LLM.
 */
export function extractTravelIntentFromConversation(input: {
  userText: string
  locale?: BrainLocale
}): IntentClassification {
  return IntentClassifier({
    text: input.userText,
    locale: input.locale ?? 'ar',
  })
}

/**
 * Map travel intent → domains the orchestrator should schedule.
 * Provider-independent; actual search still goes through execution adapters.
 */
export function domainsForIntent(intent: TravelIntent): OrchestratorDomain[] {
  switch (intent) {
    case 'SearchFlights':
      return ['flights']
    case 'SearchHotels':
      return ['hotels']
    case 'SearchPackages':
      return ['flights', 'hotels', 'transport', 'activities', 'packages']
    case 'AskRecommendation':
    case 'BudgetPlanning':
    case 'ModifyTrip':
    case 'ContinueBooking':
      return ['flights', 'hotels', 'transport', 'activities']
    case 'TravelAdvice':
    case 'VisaQuestion':
    case 'WeatherQuestion':
    case 'PackingAdvice':
    case 'CancelBooking':
    case 'GeneralConversation':
    default:
      return ['flights', 'hotels', 'transport', 'activities']
  }
}
