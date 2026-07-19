export type {
  ManagedTripStatus,
  TripSortField,
  SortDirection,
  TripAuditEvent,
  TravelerProfile,
  ManagedTripLinks,
  ManagedTripSummary,
  ManagedTrip,
  TripVersionRecord,
  TripQuery,
  TimelineSource,
  TripTimelineEvent,
  AggregatedBookingStatus,
  BookingHistoryEntry,
  PaymentHistoryEntry,
  TicketViewEntry,
  NotificationHistoryEntry,
  FavoriteDestination,
  RecentSearchRecord,
  SavedTripRecord,
} from './types'
export { MANAGED_TRIP_STATUSES } from './types'

export { maskEmail, maskPhone, maskPassport, sanitizeAuditMetadata } from './privacy'
export { appendTripAudit } from './audit'

export {
  TripRepository,
  getTripRepository,
  resetTripRepository,
} from './tripRepository'

export {
  TravelerProfileStore,
  getTravelerProfileStore,
  resetTravelerProfileStore,
  type UpsertTravelerProfileInput,
} from './travelerProfile'

export {
  SavedTripsStore,
  getSavedTripsStore,
  resetSavedTripsStore,
  type SaveTripInput,
} from './savedTrips'

export {
  FavoriteDestinationsStore,
  getFavoriteDestinationsStore,
  resetFavoriteDestinationsStore,
} from './favoriteDestinations'

export {
  RecentSearchesStore,
  getRecentSearchesStore,
  resetRecentSearchesStore,
} from './recentSearches'

export { buildTripTimeline, type TimelineSources } from './tripTimeline'

export {
  aggregateBookingStatus,
  deriveManagedTripStatus,
  type AggregateInput,
} from './bookingStatusAggregator'

export {
  BookingHistory,
  toBookingHistoryEntry,
  toPaymentHistoryEntry,
  toTicketViewEntry,
  toNotificationHistoryEntry,
  downloadConfirmationDocument,
} from './bookingHistory'

export { TripHistory, type TripHistoryBuckets } from './tripHistory'

export {
  TripManager,
  getTripManager,
  resetTripManager,
  type TripManagerOptions,
  type CreateManagedTripInput,
} from './tripManager'

/* ── Sprint 35 — Post Booking & Trip Management ───────────────────── */
export {
  isTripManagementEnabled,
  TRIP_MANAGEMENT_FEATURE_ID,
} from './TripFeatureFlags'
export * from './postBookingTypes'
export {
  TripEvents,
  createTripEvent,
  type TripEvent,
  type TripEventType,
  type TripEventListener,
} from './TripEvents'
export { TripMetrics, type TripMetricsSnapshot } from './TripMetrics'
export { TripTimeline, createTripTimeline } from './TripLifecycleTimeline'
export { ItineraryGenerator, createItineraryGenerator } from './ItineraryGenerator'
export { HotelVoucherService, createHotelVoucherService } from './HotelVoucherService'
export { TicketService, createTicketService } from './TicketService'
export { BoardingPassService, createBoardingPassService } from './BoardingPassService'
export { TripDocuments, createTripDocuments } from './TripDocuments'
export {
  FlightStatusMonitor,
  MockFlightStatusProvider,
  createFlightStatusMonitor,
  type FlightStatusProvider,
} from './FlightStatusMonitor'
export {
  NotificationScheduler,
  createNotificationScheduler,
  type TripNotificationChannelAdapter,
  type NotificationDispatchResult,
} from './NotificationScheduler'
export {
  CancellationManager,
  createCancellationManager,
  type CancellationResult,
} from './CancellationManager'
export {
  RefundStatusTracker,
  createRefundStatusTracker,
} from './RefundStatusTracker'
export {
  PostBookingRepository,
  getPostBookingRepository,
  resetPostBookingRepository,
} from './PostBookingRepository'
export {
  PostBookingService,
  createPostBookingService,
  getPostBookingService,
  resetPostBookingService,
  TripManagementError,
  type PostBookingServiceOptions,
} from './PostBookingService'
export {
  detectTripConversationQuery,
  answerTripQuery,
  shouldHandleTripQueries,
  type TripConversationQueryKind,
} from './conversation/tripQueries'
