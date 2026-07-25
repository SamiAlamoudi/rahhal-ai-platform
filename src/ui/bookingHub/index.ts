/**
 * Phase 5 Stage 6 — Booking Hub barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Booking APIs, Amadeus, Payments, Maps, Realtime, Notifications,
 * Runtime, Database, or Firebase. Gated by `ui.booking_hub` (default OFF).
 */

import { BOOKING_HUB_ISOLATION as BH_ISOLATION } from './types'

export {
  BOOKING_HUB_FEATURE_ID,
  isBookingHubEnabled,
  BookingHubRegistry,
} from './bookingHubRegistry'

export type {
  BookingHubLocale,
  BookingHubTheme,
  BookingFilterId,
  BookingStatCard,
  BookingTripCard,
  BookingServiceCard,
  BookingDocumentCard,
  BookingProviderCard,
  BookingTimelineItem,
  BookingPriceRow,
  BookingTravelerAssignment,
  BookingPlaceItem,
  BookingHubUiState,
} from './types'

export {
  BOOKING_FILTERS,
  BOOKING_HUB_ISOLATION,
} from './types'

export {
  BOOKING_HUB_TOKENS,
  bookingHubTokenCssVariables,
} from './design/bookingHubTokens'

export {
  createDemoBookingHubState,
  assertBookingHubIsolation,
} from './state/bookingHubState'

export {
  BookingHub,
  tryRenderBookingHub,
} from './components/BookingHub'
export type { BookingHubProps } from './components/BookingHub'
export { BookingToolbar } from './components/BookingToolbar'
export { BookingOverview } from './components/BookingOverview'
export { ServicesPanel } from './components/ServicesPanel'
export { DocumentsFinance } from './components/DocumentsFinance'
export { TimelineProviders } from './components/TimelineProviders'

export const BOOKING_HUB_ARCHITECTURE = {
  version: '5.6.0-booking-hub',
  featureId: 'ui.booking_hub' as const,
  presentationOnly: true,
  regions: [
    'overview',
    'upcoming_trips',
    'past_trips',
    'services',
    'documents_finance',
    'timeline',
    'providers',
    'calendar',
    'map_placeholder',
    'search',
    'filters',
    'favorites',
    'bookmarks',
  ] as const,
  ...BH_ISOLATION,
} as const
