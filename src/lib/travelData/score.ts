/**
 * Score / prioritize normalized offers (provider-agnostic).
 */

import { clamp01 } from './provenance'
import type { Activity, Flight, Hotel, Restaurant, TripOffer } from './models'

export function scoreFlight(flight: Flight): number {
  const priceScore = 1 / (1 + flight.price.amount / 1000)
  const stopsScore = flight.stops === 0 ? 1 : flight.stops === 1 ? 0.7 : 0.4
  const durationScore = 1 / (1 + flight.durationMinutes / 600)
  return clamp01(
    0.45 * flight.provenance.confidence
    + 0.25 * priceScore
    + 0.2 * stopsScore
    + 0.1 * durationScore,
  )
}

export function scoreHotel(hotel: Hotel): number {
  const priceScore = 1 / (1 + hotel.price.amount / 400)
  const ratingScore = hotel.rating != null ? hotel.rating / 5 : 0.6
  const starsScore = hotel.stars != null ? hotel.stars / 5 : 0.6
  return clamp01(
    0.4 * hotel.provenance.confidence
    + 0.25 * priceScore
    + 0.2 * ratingScore
    + 0.15 * starsScore,
  )
}

export function scoreActivity(activity: Activity): number {
  const price = activity.price?.amount ?? 150
  return clamp01(0.55 * activity.provenance.confidence + 0.45 / (1 + price / 200))
}

export function scoreRestaurant(restaurant: Restaurant): number {
  const ratingScore = restaurant.rating != null ? restaurant.rating / 5 : 0.6
  return clamp01(0.5 * restaurant.provenance.confidence + 0.5 * ratingScore)
}

export function prioritizeFlights(flights: Flight[]): Flight[] {
  return [...flights].sort((a, b) => scoreFlight(b) - scoreFlight(a))
}

export function prioritizeHotels(hotels: Hotel[]): Hotel[] {
  return [...hotels].sort((a, b) => scoreHotel(b) - scoreHotel(a))
}

export function prioritizeActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => scoreActivity(b) - scoreActivity(a))
}

export function prioritizeRestaurants(restaurants: Restaurant[]): Restaurant[] {
  return [...restaurants].sort((a, b) => scoreRestaurant(b) - scoreRestaurant(a))
}

export function scoreTripOffer(offer: TripOffer): number {
  const flight = offer.flights[0] ? scoreFlight(offer.flights[0]) : 0.5
  const hotel = offer.hotels[0] ? scoreHotel(offer.hotels[0]) : 0.5
  return clamp01(0.35 * offer.provenance.confidence + 0.35 * flight + 0.3 * hotel)
}
