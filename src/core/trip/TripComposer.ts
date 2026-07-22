/**
 * Sprint 93 — TripComposer: assemble one unified Trip from existing engine outputs.
 * Additive orchestration only — does not call/mutate engine internals beyond reading results.
 */

import { calculateTripCosts } from './TripCostCalculator'
import { combineTripConfidence } from './TripConfidence'
import { buildTripAlternatives } from './TripAlternativeBuilder'
import {
  normalizeFlightProviderResult,
  normalizeHotelProviderResult,
  segmentsFromPackageComponents,
} from './TripNormalizer'
import {
  placeholderActivity,
  placeholderHotel,
  placeholderInsurance,
  placeholderTransfer,
  placeholderVisa,
} from './placeholders'
import { recommendationFromSources, buildTripSummary } from './TripSummaryBuilder'
import { buildTripTimeline } from './TripTimelineBuilder'
import { validateTrip } from './TripValidator'
import { serializeTrip } from './TripSerializer'
import {
  SPRINT93_UNIFIED_TRIP_VERSION,
  type Trip,
  type TripComposeRequest,
  type TripComposeResult,
  type TripFlight,
  type TripHotel,
} from './types'

function avg(values: number[]): number {
  if (!values.length) return 0.7
  return values.reduce((a, b) => a + b, 0) / values.length
}

export class TripComposer {
  compose(request: TripComposeRequest): TripComposeResult {
    const started = Date.now()
    const currency = (request.currency ?? 'SAR').toUpperCase()
    const usePlaceholders = request.usePlaceholders !== false
    const adults = Math.max(1, Math.floor(request.adults ?? 1))
    const children = Math.max(0, Math.floor(request.children ?? 0))
    const destination = request.destination
      ?? request.packageSelected?.destination
      ?? null
    const origin = request.origin ?? null
    const startDate = request.startDate ?? request.packageSelected?.checkIn ?? null
    const endDate = request.endDate ?? request.packageSelected?.checkOut ?? null

    let flights: TripFlight[] = (request.flightOffers ?? []).map((o, i) =>
      normalizeFlightProviderResult(o, i, { currency }),
    )
    let hotel: TripHotel | null = (request.hotelOffers?.[0]
      ? normalizeHotelProviderResult(request.hotelOffers[0], 0, { currency })
      : null)

    let activities = [] as ReturnType<typeof segmentsFromPackageComponents>['activities']
    let transfers = [] as ReturnType<typeof segmentsFromPackageComponents>['transfers']
    let insurance = null as ReturnType<typeof segmentsFromPackageComponents>['insurance']
    let visa = null as ReturnType<typeof segmentsFromPackageComponents>['visa']

    if (request.packageSelected?.components?.length) {
      const fromPkg = segmentsFromPackageComponents(
        request.packageSelected.components,
        request.packageSelected.currency || currency,
      )
      if (!flights.length) flights = fromPkg.flights
      if (!hotel) hotel = fromPkg.hotel
      activities = fromPkg.activities
      transfers = fromPkg.transfers
      insurance = fromPkg.insurance
      visa = fromPkg.visa
    }

    if (usePlaceholders) {
      if (!hotel) {
        hotel = placeholderHotel({
          destination,
          checkIn: startDate,
          checkOut: endDate,
          currency,
        })
      }
      if (!transfers.length) {
        transfers = [placeholderTransfer({
          destination,
          startAt: flights[0]?.arrivalAt ?? startDate,
          currency,
        })]
      }
      if (!activities.length) {
        activities = [placeholderActivity({
          destination,
          startAt: startDate,
          currency,
        })]
      }
      if (!insurance) insurance = placeholderInsurance({ currency })
      if (!visa) visa = placeholderVisa({ destination, currency })
    }

    const pricingSummary = calculateTripCosts({
      flights,
      hotel,
      transfers,
      activities,
      insurance,
      visa,
      currency,
      budgetCap: request.budgetCap ?? null,
    })

    const timeline = buildTripTimeline({ flights, hotel, activities, transfers })
    const validation = validateTrip({
      flights,
      hotel,
      startDate,
      endDate,
      pricing: pricingSummary,
      timeline,
      currency,
    })

    const providerConfidence = avg([
      ...flights.map((f) => f.confidence),
      ...(hotel ? [hotel.confidence] : []),
    ])

    const confidence = combineTripConfidence({
      providerConfidence,
      priceConfidence: request.priceConfidence,
      decisionConfidence: request.decision?.confidence,
      packageConfidence: request.packageSelected?.confidence,
    })

    const recommendation = recommendationFromSources({
      packageExplanation: request.packageSelected?.explanation,
      decisionExplanation: request.decision?.explanation,
      destination,
    })

    const alternatives = buildTripAlternatives({
      primaryPackageId: request.packageSelected?.id ?? null,
      ranked: request.packageRanked?.length
        ? request.packageRanked
        : (request.packageSelected ? [request.packageSelected] : []),
      decision: request.decision,
      currency,
    })

    const summary = buildTripSummary({
      destination,
      origin,
      travelersTotal: adults + children,
      startDate,
      endDate,
      pricing: pricingSummary,
      recommendation,
      flightAirline: flights[0]?.airline,
      hotelName: hotel?.name,
      priceTimingNote: request.priceTimingNote,
    })

    const trip: Trip = {
      id: `trip_${request.conversationId ?? Date.now().toString(36)}`,
      version: SPRINT93_UNIFIED_TRIP_VERSION,
      destination,
      origin,
      dates: {
        start: startDate,
        end: endDate,
        durationDays: request.durationDays ?? null,
      },
      travelers: {
        adults,
        children,
        total: adults + children,
        travelerType: request.travelerType ?? null,
      },
      flights,
      hotel,
      activities,
      transfers,
      insurance,
      visa,
      budget: request.budgetCap ?? null,
      currency,
      confidence,
      recommendation,
      warnings: validation.warnings,
      alternatives,
      timeline,
      pricingSummary,
      summary,
      valid: validation.ok,
      validationErrors: validation.errors,
    }

    return {
      version: SPRINT93_UNIFIED_TRIP_VERSION,
      trip,
      serialized: serializeTrip(trip),
      durationMs: Date.now() - started,
    }
  }
}

export function createTripComposer(): TripComposer {
  return new TripComposer()
}

export function composeUnifiedTrip(request: TripComposeRequest): TripComposeResult {
  return createTripComposer().compose(request)
}
