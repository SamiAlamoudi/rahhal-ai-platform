/**
 * Phase 5 Stage 6 — Booking Hub contracts.
 * Presentation only. No booking APIs, payments, maps, AI, or databases.
 */

export type BookingHubLocale = 'ar' | 'en'
export type BookingHubTheme = 'light' | 'dark'

export type BookingFilterId =
  | 'all'
  | 'upcoming'
  | 'past'
  | 'flights'
  | 'hotels'
  | 'transport'

export interface BookingStatCard {
  id: string
  label: string
  value: string
}

export interface BookingTripCard {
  id: string
  title: string
  subtitle: string
  statusLabel: string
  dateLabel: string
}

export interface BookingServiceCard {
  id: string
  title: string
  meta: string
  priceLabel: string
}

export interface BookingDocumentCard {
  id: string
  title: string
  statusLabel: string
}

export interface BookingProviderCard {
  id: string
  name: string
  category: string
  statusLabel: string
}

export interface BookingTimelineItem {
  id: string
  whenLabel: string
  title: string
}

export interface BookingPriceRow {
  id: string
  label: string
  amountLabel: string
  percent: number
}

export interface BookingTravelerAssignment {
  id: string
  traveler: string
  bookingLabel: string
}

export interface BookingPlaceItem {
  id: string
  name: string
  meta: string
}

export interface BookingHubUiState {
  locale: BookingHubLocale
  theme: BookingHubTheme
  activeFilter: BookingFilterId
  searchQuery: string
  overview: string
  stats: BookingStatCard[]
  upcomingTrips: BookingTripCard[]
  pastTrips: BookingTripCard[]
  flights: BookingServiceCard[]
  hotels: BookingServiceCard[]
  transportation: BookingServiceCard[]
  cruises: BookingServiceCard[]
  trains: BookingServiceCard[]
  activities: BookingServiceCard[]
  restaurants: BookingServiceCard[]
  events: BookingServiceCard[]
  insurance: BookingServiceCard[]
  visaStatus: BookingDocumentCard[]
  documents: BookingDocumentCard[]
  tickets: BookingDocumentCard[]
  invoices: BookingDocumentCard[]
  refunds: BookingDocumentCard[]
  paymentSummaryLabel: string
  travelerAssignments: BookingTravelerAssignment[]
  bookingTimeline: BookingTimelineItem[]
  priceBreakdown: BookingPriceRow[]
  providers: BookingProviderCard[]
  calendarDays: string[]
  mapPlaceholder: string
  favorites: BookingPlaceItem[]
  bookmarks: BookingPlaceItem[]
  featureEnabled: boolean
}

export const BOOKING_FILTERS: readonly BookingFilterId[] = [
  'all',
  'upcoming',
  'past',
  'flights',
  'hotels',
  'transport',
] as const

export const BOOKING_HUB_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoBookingApis: false,
  wiredIntoAmadeus: false,
  wiredIntoPayments: false,
  wiredIntoMaps: false,
  wiredIntoRealtime: false,
  wiredIntoNotifications: false,
  wiredIntoRuntime: false,
  wiredIntoDatabase: false,
  wiredIntoFirebase: false,
  backend: false,
} as const
