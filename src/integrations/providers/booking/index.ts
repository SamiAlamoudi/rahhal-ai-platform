export {
  BookingComApiClient,
  type HotelSearchQuery,
  type ApiClientConfig as BookingApiClientConfig,
  type ApiClientResult as BookingApiClientResult,
  type BookingComSearchResponse,
  type BookingComHotelResult,
  type BookingComDestinationResult,
  type BookingComDestinationSearchResponse,
  type ResolvedBookingDestination,
  normalizeDestinationPayload,
} from './bookingComApiClient'
export { BookingComAdapter, type BookingComAdapterConfig } from './bookingComAdapter'
export {
  resolveBookingDestination,
  normalizeDestinationQuery,
  parseNumericDestId,
  pickBestDestination,
  mapDestType,
  type DestinationResolveResult,
  type BookingDestType,
} from './destinationResolution'
export {
  normalizeBookingComResponse,
  normalizeToHotelModel,
  normalizeBookingComHotel,
  normalizeBookingComToHotelOffer,
  type Hotel,
} from './hotelNormalization'
