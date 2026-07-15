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
