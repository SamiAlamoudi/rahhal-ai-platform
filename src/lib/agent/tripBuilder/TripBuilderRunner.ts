/**
 * Sprint 110 — TripBuilderRunner
 * Feature-flag gate: OFF → disabled result (legacy behavior unchanged).
 */

import { buildTrips, createTripBuilder, type TripBuilderOptions } from './TripBuilder'
import { isTripBuilderEnabled } from './feature'
import type {
  TripBuilderInput,
  TripBuilderLogEntry,
  TripBuilderResult,
} from './types'
import {
  buildTripMetadata,
  toResponseComposerInput,
} from './TripMetadata'
import { SPRINT110_TRIP_BUILDER_VERSION } from './types'

export interface TripBuilderRunnerOptions extends TripBuilderOptions {
  enabled?: boolean
}

function disabledResult(input: TripBuilderInput): TripBuilderResult {
  return {
    version: SPRINT110_TRIP_BUILDER_VERSION,
    enabled: false,
    ok: false,
    empty: true,
    trips: [],
    ranked: [],
    rankings: [],
    selected: null,
    flightOffers: [],
    hotelStays: [],
    responseComposerPackages: [],
    responseComposerInput: toResponseComposerInput({
      conversationId: input.conversationId,
      destination: input.destination,
      departureDate: input.departureDate,
      returnDate: input.returnDate ?? null,
      currency: input.currency ?? null,
      adults: input.adults ?? null,
      packages: [],
      selected: null,
      rankings: [],
    }),
    confidence: 0,
    error: null,
    validationErrors: [],
    logs: ['trip_builder_disabled'],
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
  }
}

export class TripBuilderRunner {
  private readonly options: TripBuilderRunnerOptions
  private readonly logs: TripBuilderLogEntry[] = []

  constructor(options: TripBuilderRunnerOptions = {}) {
    this.options = options
  }

  getStructuredLogs(): readonly TripBuilderLogEntry[] {
    return this.logs.slice()
  }

  clearStructuredLogs(): void {
    this.logs.length = 0
  }

  run(input: TripBuilderInput): TripBuilderResult {
    if (!isTripBuilderEnabled({ enabled: this.options.enabled })) {
      this.logs.push({
        at: new Date().toISOString(),
        level: 'info',
        message: 'trip_builder.disabled',
      })
      return disabledResult(input)
    }

    const builder = createTripBuilder({ logger: this.options.logger })
    const result = builder.build(input)
    this.logs.push(...builder.getStructuredLogs())
    return result
  }
}

export function createTripBuilderRunner(
  options?: TripBuilderRunnerOptions,
): TripBuilderRunner {
  return new TripBuilderRunner(options)
}

export function runTripBuilder(
  input: TripBuilderInput,
  options?: TripBuilderRunnerOptions,
): TripBuilderResult {
  return createTripBuilderRunner(options).run(input)
}

export { buildTrips }
