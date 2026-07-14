export { BookingComApiClient, type HotelSearchQuery, type ApiClientConfig as BookingApiClientConfig, type ApiClientResult as BookingApiClientResult, type BookingComSearchResponse, type BookingComHotelResult } from './bookingComApiClient'
export { BookingComAdapter, type BookingComAdapterConfig } from './bookingComAdapter'
export {
  normalizeBookingComResponse,
  normalizeToHotelModel,
  normalizeBookingComHotel,
  normalizeBookingComToHotelOffer,
  type Hotel,
} from './hotelNormalization'
