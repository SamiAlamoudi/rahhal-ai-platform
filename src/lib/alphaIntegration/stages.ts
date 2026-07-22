/**
 * Sprint 103 — journey stage inventory (existing modules only).
 */

import type { AlphaJourneyStageDef } from './types'

/** Declares how Alpha stages map onto already-shipped modules. */
export const ALPHA_JOURNEY_STAGES: AlphaJourneyStageDef[] = [
  {
    id: 'conversation',
    label: 'Conversation',
    module: 'src/pages/ChatPage.tsx · chatEngine',
    connected: true,
    notes: 'Primary /chat experience',
  },
  {
    id: 'planning',
    label: 'Planning',
    module: 'src/lib/agent/travelPlanner',
    connected: true,
    notes: 'Travel strategy planner in planTurn',
  },
  {
    id: 'search',
    label: 'Search',
    module: 'agent tools · flight/hotel search engines',
    connected: true,
    notes: 'Tool batch in travelAgentService',
  },
  {
    id: 'decision',
    label: 'Decision',
    module: 'src/core/decisionEngine · autonomousDecision',
    connected: true,
    notes: 'Autonomous decision snapshot on meta',
  },
  {
    id: 'packages',
    label: 'Packages',
    module: 'src/core/packageBuilder',
    connected: true,
    notes: 'dynamicPackages on meta',
  },
  {
    id: 'price_intelligence',
    label: 'Price Intelligence',
    module: 'src/core/priceIntelligence',
    connected: true,
    notes: 'priceIntelligence on meta',
  },
  {
    id: 'concierge',
    label: 'Concierge',
    module: 'src/core/conciergeExperience · conciergeIntegration',
    connected: true,
    notes: 'conciergeExperience + conciergeRecommendation meta',
  },
  {
    id: 'alpha_experience',
    label: 'Alpha Experience',
    module: 'src/core/alphaExperience',
    connected: true,
    notes: 'alphaTravelerExperience meta (Sprint 99)',
  },
  {
    id: 'booking_assistant',
    label: 'Booking Assistant',
    module: 'src/core/bookingAssistant',
    connected: true,
    notes: 'bookingAssistant meta (Sprint 101)',
  },
  {
    id: 'booking_review',
    label: 'Booking Review',
    module: 'BookingAssistantReviewPage',
    connected: true,
    notes: '/booking-assistant/review',
  },
  {
    id: 'traveler_confirmation',
    label: 'Traveler Confirmation',
    module: 'TravelerConfirmationForm',
    connected: true,
    notes: 'Step inside assistant review',
  },
  {
    id: 'book_now',
    label: 'Book Now',
    module: 'BookNowWorkflow · abstract adapter',
    connected: true,
    notes: 'Sprint 102 abstract BookingProviderAdapter',
  },
  {
    id: 'booking_execution',
    label: 'Booking Execution',
    module: 'bookingExecutionConfirmation',
    connected: true,
    notes: 'Lifecycle pending→confirmed/failed/cancelled',
  },
  {
    id: 'confirmation',
    label: 'Confirmation',
    module: 'BookingAssistantConfirmationPage',
    connected: true,
    notes: '/booking-assistant/confirmation/:bookingId',
  },
  {
    id: 'my_trips',
    label: 'My Trips',
    module: 'src/pages/MyTrips.tsx',
    connected: true,
    notes: '/my-trips entry (ui.my_trips / ai.my_trips_dashboard alias)',
  },
]

export function allStagesConnected(): boolean {
  return ALPHA_JOURNEY_STAGES.every((s) => s.connected)
}
