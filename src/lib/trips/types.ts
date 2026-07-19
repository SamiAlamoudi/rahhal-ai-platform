/**
 * Phase V — My Trips & Booking Management domain models.
 * Mock repository storage only; TripPlan APIs stay unchanged.
 */

export type ManagedTripStatus =
  | 'draft'
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'archived'

export type TripSortField = 'startDate' | 'createdAt' | 'updatedAt' | 'destination' | 'title'
export type SortDirection = 'asc' | 'desc'

export interface TripAuditEvent {
  id: string
  at: string
  type: string
  message: string
  fromStatus: ManagedTripStatus | null
  toStatus: ManagedTripStatus | null
  actorUserId: string | null
  /** Sanitized metadata only — no payment secrets / raw PII. */
  metadata: Record<string, unknown>
}

export interface TravelerProfile {
  id: string
  userId: string
  firstName: string
  lastName: string
  type: 'adult' | 'child' | 'infant'
  nationality: string | null
  /** Masked only. */
  passportMasked: string | null
  emailMasked: string | null
  phoneMasked: string | null
  createdAt: string
  updatedAt: string
}

export interface ManagedTripLinks {
  tripPlanId: string | null
  savedTripId: string | null
  bookingSessionIds: string[]
  orderIds: string[]
  paymentSessionIds: string[]
  ticketSessionIds: string[]
  notificationSessionIds: string[]
}

export interface ManagedTripSummary {
  destination: string
  destinations: string[]
  startDate: string | null
  endDate: string | null
  currency: string
  estimatedTotal: number | null
  travelerCount: number
  primaryBookingStatus: string | null
  primaryPaymentStatus: string | null
  primaryTicketStatus: string | null
}

/** Versioned managed trip record (does not mutate TripPlan). */
export interface ManagedTrip {
  id: string
  userId: string
  version: number
  status: ManagedTripStatus
  title: string
  favorite: boolean
  archived: boolean
  travelerIds: string[]
  links: ManagedTripLinks
  summary: ManagedTripSummary
  /** Snapshot of itinerary title/days for duplicate/rebook — not a TripPlan mutation. */
  itinerarySnapshot: {
    title: string
    destinations: string[]
    notes: string | null
  } | null
  audit: TripAuditEvent[]
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  archivedAt: string | null
}

export interface TripVersionRecord {
  tripId: string
  version: number
  recordedAt: string
  snapshot: ManagedTrip
}

export interface TripQuery {
  userId: string
  status?: ManagedTripStatus | ManagedTripStatus[]
  destination?: string
  travelerId?: string
  travelerName?: string
  search?: string
  includeArchived?: boolean
  favoritesOnly?: boolean
  sortBy?: TripSortField
  sortDirection?: SortDirection
}

export type TimelineSource =
  | 'booking'
  | 'payment'
  | 'ticketing'
  | 'notification'
  | 'trip'

export interface TripTimelineEvent {
  id: string
  at: string
  source: TimelineSource
  type: string
  message: string
  relatedId: string | null
  status: string | null
  metadata: Record<string, unknown>
}

export interface AggregatedBookingStatus {
  bookingSessionId: string | null
  bookingStatus: string | null
  orderId: string | null
  orderStatus: string | null
  paymentSessionId: string | null
  paymentStatus: string | null
  ticketSessionId: string | null
  ticketStatus: string | null
  active: boolean
  cancelled: boolean
  paid: boolean
  ticketed: boolean
}

export interface BookingHistoryEntry {
  bookingSessionId: string
  status: string
  total: number
  currency: string
  itemCount: number
  itemTitles: string[]
  createdAt: string
  updatedAt: string
  confirmedAt: string | null
  /** Sprint 13 — temporary or supplier booking reference. */
  bookingReference?: string
  /** Sprint 13 — upcoming | completed | cancelled */
  bucket?: 'upcoming' | 'completed' | 'cancelled'
}

export interface PaymentHistoryEntry {
  orderId: string
  orderNumber: string
  paymentSessionId: string | null
  status: string
  amount: number
  currency: string
  /** Masked — never raw. */
  customerEmailMasked: string | null
  paidAt: string | null
  createdAt: string
}

export interface TicketViewEntry {
  ticketSessionId: string
  status: string
  confirmationNumber: string | null
  bookingReference: string | null
  flightTitles: string[]
  hotelTitles: string[]
  hotelVouchers: Array<{
    title: string
    hotelConfirmationNumber: string | null
    checkIn: string | null
    checkOut: string | null
  }>
  issuedAt: string | null
}

export interface NotificationHistoryEntry {
  sessionId: string
  eventType: string
  status: string
  channels: string[]
  subject: string
  createdAt: string
  deliveredAt: string | null
}

export interface FavoriteDestination {
  id: string
  userId: string
  destination: string
  createdAt: string
}

export interface RecentSearchRecord {
  id: string
  userId: string
  query: string
  destination: string | null
  searchedAt: string
  metadata: Record<string, unknown>
}

export interface SavedTripRecord {
  id: string
  userId: string
  title: string
  destination: string
  tripId: string | null
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export const MANAGED_TRIP_STATUSES: readonly ManagedTripStatus[] = [
  'draft',
  'upcoming',
  'active',
  'completed',
  'cancelled',
  'archived',
] as const
