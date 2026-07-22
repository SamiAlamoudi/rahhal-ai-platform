/**
 * Sprint 110 — TripBuilder
 * Orchestrates validate → compose → rank → adapters for Decision Engine /
 * Response Composer. Does not modify those engines.
 */

import type { RahhalFlightSearchOffer } from '../liveFlightSearch/types'
import type { HotelOffer } from '../liveHotelSearch/types'
import { composeTripCandidates } from './TripBuilderComposer'
import { validateTripBuilderInput } from './TripBuilderValidator'
import { rankTrips } from './TripRanking'
import {
  buildResponseComposerPackages,
  buildTripMetadata,
  prioritizeOffersForDecisionEngine,
  toResponseComposerInput,
} from './TripMetadata'
import type {
  TripBuilderError,
  TripBuilderInput,
  TripBuilderLogEntry,
  TripBuilderResult,
  TripBuilderStructuredLogger,
} from './types'
import {
  createSilentTripBuilderLogger,
  SPRINT110_TRIP_BUILDER_VERSION,
} from './types'

export interface TripBuilderOptions {
  logger?: TripBuilderStructuredLogger
}

function emptyComposerInput(
  input: TripBuilderInput,
): TripBuilderResult['responseComposerInput'] {
  return {
    conversationId: input.conversationId ?? null,
    trip: {
      destination: input.destination ?? null,
      departureDate: input.departureDate ?? null,
      returnDate: input.returnDate ?? null,
      currency: input.currency ?? null,
      travelers: input.adults ?? null,
    },
    flights: [],
    decisionConfidence: null,
    decisionExplanation: null,
    labeled: null,
  }
}

function baseResult(
  input: TripBuilderInput,
  partial: Partial<TripBuilderResult> & {
    ok: boolean
    empty: boolean
    error: TripBuilderError | null
  },
): TripBuilderResult {
  return {
    version: SPRINT110_TRIP_BUILDER_VERSION,
    enabled: true,
    trips: [],
    ranked: [],
    rankings: [],
    selected: null,
    flightOffers: [],
    hotelStays: [],
    responseComposerPackages: [],
    responseComposerInput: emptyComposerInput(input),
    confidence: 0,
    validationErrors: [],
    logs: [],
    latencyMs: 0,
    meta: buildTripMetadata({
      destination: input.destination ?? null,
      departureDate: input.departureDate ?? null,
      returnDate: input.returnDate ?? null,
      checkInDate: input.checkInDate ?? null,
      checkOutDate: input.checkOutDate ?? null,
      budget: input.budget ?? null,
      currency: input.currency ?? null,
      flightCount: input.flights?.length ?? 0,
      hotelCount: input.hotels?.length ?? 0,
      candidateCount: 0,
      conversationId: input.conversationId ?? null,
    }),
    ...partial,
  }
}

export class TripBuilder {
  private readonly logger: TripBuilderStructuredLogger
  private readonly logs: TripBuilderLogEntry[] = []

  constructor(options: TripBuilderOptions = {}) {
    this.logger = options.logger ?? createSilentTripBuilderLogger()
  }

  getStructuredLogs(): readonly TripBuilderLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  private emit(
    level: TripBuilderLogEntry['level'],
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const entry: TripBuilderLogEntry = {
      at: new Date().toISOString(),
      level,
      message,
      meta,
    }
    this.logs.push(entry)
    this.logger(entry)
  }

  build(input: TripBuilderInput): TripBuilderResult {
    const started = Date.now()
    this.emit('info', 'trip_builder.start', {
      flightCount: input.flights?.length ?? 0,
      hotelCount: input.hotels?.length ?? 0,
    })

    const validation = validateTripBuilderInput(input)
    if (!validation.ok || !validation.normalized) {
      this.emit('warn', 'trip_builder.validation_failed', {
        errors: validation.errors,
      })
      return baseResult(input, {
        ok: false,
        empty: true,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors.join('; ') || 'Invalid trip builder input',
          retryable: false,
        },
        validationErrors: validation.errors,
        logs: this.logs.map((l) => l.message),
        latencyMs: Date.now() - started,
      })
    }

    const norm = validation.normalized
    const flights: RahhalFlightSearchOffer[] = input.flights ?? []
    const hotels: HotelOffer[] = input.hotels ?? []

    if (input.flightSearchError || input.hotelSearchError) {
      const signal = input.flightSearchError ?? input.hotelSearchError!
      this.emit('warn', 'trip_builder.provider_signal', {
        code: signal.code,
        message: signal.message,
      })
    }

    if (flights.length === 0 || hotels.length === 0) {
      const code =
        flights.length === 0 && hotels.length === 0
          ? 'EMPTY_RESULTS'
          : flights.length === 0
            ? 'EMPTY_FLIGHTS'
            : 'EMPTY_HOTELS'
      const providerCode =
        input.flightSearchError?.code
        ?? input.hotelSearchError?.code
        ?? null
      this.emit('warn', 'trip_builder.empty_pools', { code, providerCode })
      return baseResult(input, {
        ok: false,
        empty: true,
        error: {
          code: providerCode && /UNAUTHORIZED|RATE_LIMIT|TIMEOUT|PROVIDER/i.test(providerCode)
            ? providerCode
            : code,
          message:
            providerCode
              ? (input.flightSearchError?.message
                ?? input.hotelSearchError?.message
                ?? 'Provider failure with empty offer pools')
              : code === 'EMPTY_FLIGHTS'
                ? 'No flight offers available to build trips'
                : code === 'EMPTY_HOTELS'
                  ? 'No hotel offers available to build trips'
                  : 'No flight or hotel offers available to build trips',
          retryable: Boolean(
            input.flightSearchError?.retryable
            ?? input.hotelSearchError?.retryable,
          ),
        },
        meta: buildTripMetadata({
          destination: norm.destination,
          departureDate: norm.departureDate,
          returnDate: norm.returnDate,
          checkInDate: norm.checkInDate,
          checkOutDate: norm.checkOutDate,
          budget: norm.budget,
          currency: norm.currency,
          flightCount: flights.length,
          hotelCount: hotels.length,
          candidateCount: 0,
          conversationId: input.conversationId ?? null,
        }),
        logs: this.logs.map((l) => l.message),
        latencyMs: Date.now() - started,
      })
    }

    const trips = composeTripCandidates(flights, hotels, {
      destination: norm.destination,
      departureDate: norm.departureDate,
      returnDate: norm.returnDate,
      checkInDate: norm.checkInDate,
      checkOutDate: norm.checkOutDate,
      budget: norm.budget,
      currency: norm.currency,
      preferences: input.preferences,
      maxCandidates: norm.maxCandidates,
    })

    const compatible = trips.filter((t) => t.compatible)
    if (compatible.length === 0) {
      this.emit('warn', 'trip_builder.no_compatible', {
        candidateCount: trips.length,
      })
      const { ranked, rankings, selected } = rankTrips(trips)
      const packages = buildResponseComposerPackages(ranked, rankings)
      const pools = prioritizeOffersForDecisionEngine({ ranked })
      return baseResult(input, {
        ok: false,
        empty: true,
        trips,
        ranked,
        rankings,
        selected,
        flightOffers: pools.flightOffers,
        hotelStays: pools.hotelStays,
        responseComposerPackages: packages,
        responseComposerInput: toResponseComposerInput({
          conversationId: input.conversationId,
          destination: norm.destination,
          departureDate: norm.departureDate,
          returnDate: norm.returnDate,
          currency: norm.currency,
          adults: norm.adults,
          packages,
          selected,
          rankings,
        }),
        confidence: selected?.confidence ?? 0,
        error: {
          code: 'INCOMPATIBLE_OFFERS',
          message: 'No compatible flight+hotel combinations for the given dates',
          retryable: false,
        },
        meta: buildTripMetadata({
          destination: norm.destination,
          departureDate: norm.departureDate,
          returnDate: norm.returnDate,
          checkInDate: norm.checkInDate,
          checkOutDate: norm.checkOutDate,
          budget: norm.budget,
          currency: norm.currency,
          flightCount: flights.length,
          hotelCount: hotels.length,
          candidateCount: trips.length,
          conversationId: input.conversationId ?? null,
        }),
        logs: this.logs.map((l) => l.message),
        latencyMs: Date.now() - started,
      })
    }

    const { ranked, rankings, selected } = rankTrips(compatible)
    const packages = buildResponseComposerPackages(ranked, rankings)
    const pools = prioritizeOffersForDecisionEngine({ ranked })
    const responseComposerInput = toResponseComposerInput({
      conversationId: input.conversationId,
      destination: norm.destination,
      departureDate: norm.departureDate,
      returnDate: norm.returnDate,
      currency: norm.currency,
      adults: norm.adults,
      packages,
      selected,
      rankings,
    })

    this.emit('info', 'trip_builder.done', {
      candidateCount: ranked.length,
      selectedId: selected?.id ?? null,
    })

    return {
      version: SPRINT110_TRIP_BUILDER_VERSION,
      enabled: true,
      ok: true,
      empty: false,
      trips: ranked,
      ranked,
      rankings,
      selected,
      flightOffers: pools.flightOffers,
      hotelStays: pools.hotelStays,
      responseComposerPackages: packages,
      responseComposerInput,
      confidence: selected?.confidence ?? 0,
      error: null,
      validationErrors: [],
      logs: this.logs.map((l) => l.message),
      latencyMs: Date.now() - started,
      meta: buildTripMetadata({
        destination: norm.destination,
        departureDate: norm.departureDate,
        returnDate: norm.returnDate,
        checkInDate: norm.checkInDate,
        checkOutDate: norm.checkOutDate,
        budget: norm.budget,
        currency: norm.currency,
        flightCount: flights.length,
        hotelCount: hotels.length,
        candidateCount: ranked.length,
        conversationId: input.conversationId ?? null,
      }),
    }
  }
}

export function createTripBuilder(options?: TripBuilderOptions): TripBuilder {
  return new TripBuilder(options)
}

export function buildTrips(
  input: TripBuilderInput,
  options?: TripBuilderOptions,
): TripBuilderResult {
  return createTripBuilder(options).build(input)
}
