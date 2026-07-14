import type { ProviderSearchResult } from '../../searchOrchestrator'
import type { FlightOffer } from '../../contracts/models/flight'
import type { HotelOffer } from '../../contracts/models/hotel'
import type { ActivityOffer } from '../../contracts/models/activity'
import type { TransferOffer } from '../../contracts/models/transfer'

export function flightOfferToSearchResult(offer: FlightOffer): ProviderSearchResult {
  const seg = offer.itinerary.segments[0]
  return {
    providerId: offer.providerId,
    providerName: '',
    providerType: 'flight',
    externalId: offer.id,
    title: offer.title,
    description: '',
    currency: offer.currency,
    price: offer.price,
    originalPrice: offer.originalPrice,
    durationMinutes: offer.itinerary.totalDuration,
    stops: offer.itinerary.stops,
    rating: offer.rating,
    location: seg ? `${seg.origin} → ${seg.destination}` : null,
    cancellationPolicy: offer.cancellationPolicy,
    baggageIncluded: offer.itinerary.baggageIncluded,
    familyFriendly: offer.familyFriendly,
    rawMetadata: {
      airline: seg?.carrier ?? '',
      flightNumber: seg?.flightNumber ?? '',
      origin: seg?.origin ?? '',
      destination: seg?.destination ?? '',
      departureTime: seg?.departure ?? '',
      arrivalTime: seg?.arrival ?? '',
      cabin: seg?.cabin ?? '',
    },
    retrievedAt: new Date().toISOString(),
  }
}

export function hotelOfferToSearchResult(offer: HotelOffer): ProviderSearchResult {
  return {
    providerId: offer.providerId,
    providerName: '',
    providerType: 'hotel',
    externalId: offer.id,
    title: offer.title,
    description: '',
    currency: offer.currency,
    price: offer.price,
    originalPrice: offer.originalPrice,
    durationMinutes: null,
    stops: null,
    rating: offer.rating,
    location: offer.location,
    cancellationPolicy: offer.freeCancellation ? 'free cancellation 48h' : 'non-refundable',
    baggageIncluded: null,
    familyFriendly: offer.familyFriendly,
    rawMetadata: {
      hotelStars: offer.hotelStars,
      checkInDate: offer.checkIn,
      checkOutDate: offer.checkOut,
      breakfastIncluded: offer.breakfastIncluded,
      amenities: offer.amenities.join(','),
    },
    retrievedAt: new Date().toISOString(),
  }
}

export function activityOfferToSearchResult(offer: ActivityOffer): ProviderSearchResult {
  return {
    providerId: offer.providerId,
    providerName: '',
    providerType: 'activity',
    externalId: offer.id,
    title: offer.title,
    description: '',
    currency: offer.currency,
    price: offer.price,
    originalPrice: offer.originalPrice,
    durationMinutes: offer.durationMinutes,
    stops: null,
    rating: offer.rating,
    location: offer.location,
    cancellationPolicy: offer.cancellationPolicy,
    baggageIncluded: null,
    familyFriendly: offer.familyFriendly,
    rawMetadata: {
      activityType: offer.activityType,
      destination: offer.destination,
    },
    retrievedAt: new Date().toISOString(),
  }
}

export function transferOfferToSearchResult(offer: TransferOffer): ProviderSearchResult {
  return {
    providerId: offer.providerId,
    providerName: '',
    providerType: 'transportation',
    externalId: offer.id,
    title: offer.title,
    description: '',
    currency: offer.currency,
    price: offer.price,
    originalPrice: null,
    durationMinutes: offer.durationMinutes,
    stops: 0,
    rating: offer.rating,
    location: offer.location,
    cancellationPolicy: offer.cancellationPolicy,
    baggageIncluded: null,
    familyFriendly: offer.familyFriendly,
    rawMetadata: {
      transportType: offer.transferType,
      origin: offer.origin,
      destination: offer.destination,
    },
    retrievedAt: new Date().toISOString(),
  }
}
