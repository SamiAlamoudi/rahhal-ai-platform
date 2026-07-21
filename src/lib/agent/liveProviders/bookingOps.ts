/**
 * Sprint 61 — Named booking operations over the existing LiveProviderSdk.
 * No new engines: thin wrappers used by Booking Execution + tests.
 */

import { createProviderRequestId, logProviderRequest } from './providerLog'
import type {
  LiveOrderContext,
  LiveOrderResult,
  LiveProviderSdk,
} from './types'

function isFlightSdk(sdk: LiveProviderSdk): boolean {
  return Boolean(sdk.capabilities.flights && sdk.createOrder)
}

function isHotelSdk(sdk: LiveProviderSdk): boolean {
  return Boolean(sdk.capabilities.hotels && sdk.createOrder)
}

async function timedOrder(
  sdk: LiveProviderSdk,
  operation: string,
  fn: () => Promise<LiveOrderResult>,
  refs?: { bookingId?: string | null; providerReference?: string | null },
): Promise<LiveOrderResult> {
  const requestId = createProviderRequestId('ord')
  const started = Date.now()
  try {
    const result = await fn()
    logProviderRequest({
      requestId,
      provider: sdk.providerId,
      operation,
      durationMs: Date.now() - started,
      status: result.ok ? (result.status ?? 'confirmed') : (result.errorCode ?? 'failed'),
      bookingId: refs?.bookingId ?? null,
      providerReference: result.orderId ?? refs?.providerReference ?? null,
      detail: result.error ?? undefined,
    })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'order_failed'
    const timeout = /abort|timeout/i.test(message)
    const result: LiveOrderResult = {
      ok: false,
      error: message,
      errorCode: timeout ? 'timeout' : 'unavailable',
      retryable: true,
    }
    logProviderRequest({
      requestId,
      provider: sdk.providerId,
      operation,
      durationMs: Date.now() - started,
      status: result.errorCode!,
      bookingId: refs?.bookingId ?? null,
      providerReference: refs?.providerReference ?? null,
      detail: message,
    })
    return result
  }
}

/** Normalized flight booking view (Sprint 61 deliverable shape). */
export type NormalizedFlightBooking = {
  bookingId: string
  providerBookingId: string | null
  pnr: string | null
  ticketNumbers: string[]
  travelerList: Array<{ firstName: string; lastName: string }>
  status: string
  price: number
  currency: string
  createdAt: string
}

/** Normalized hotel booking view (Sprint 61 deliverable shape). */
export type NormalizedHotelBooking = {
  reservationId: string
  hotelConfirmation: string | null
  guestNames: string[]
  roomType: string | null
  checkIn: string | null
  checkOut: string | null
  status: string
  totalPrice: number
  currency: string
}

export function toNormalizedFlightBooking(result: LiveOrderResult): NormalizedFlightBooking | null {
  if (!result.ok || !result.orderId) return null
  return {
    bookingId: result.orderId,
    providerBookingId: result.providerBookingId ?? result.orderId,
    pnr: result.pnr ?? null,
    ticketNumbers: result.ticketNumbers ?? [],
    travelerList: (result.travelerList ?? []).map((t) => ({
      firstName: t.firstName,
      lastName: t.lastName,
    })),
    status: result.status ?? 'confirmed',
    price: result.price?.amount ?? 0,
    currency: result.currency ?? result.price?.currency ?? 'USD',
    createdAt: result.createdAt ?? new Date().toISOString(),
  }
}

export function toNormalizedHotelBooking(result: LiveOrderResult): NormalizedHotelBooking | null {
  if (!result.ok || !result.orderId) return null
  return {
    reservationId: result.orderId,
    hotelConfirmation: result.hotelConfirmation ?? result.providerBookingId ?? result.orderId,
    guestNames: result.guestNames
      ?? (result.travelerList ?? []).map((t) => `${t.firstName} ${t.lastName}`.trim()),
    roomType: result.roomType ?? null,
    checkIn: result.checkIn ?? null,
    checkOut: result.checkOut ?? null,
    status: result.status ?? 'confirmed',
    totalPrice: result.price?.amount ?? 0,
    currency: result.currency ?? result.price?.currency ?? 'USD',
  }
}

export async function createFlightBooking(input: {
  sdk: LiveProviderSdk
  offerId: string
  travelers?: LiveOrderContext['travelers']
  conversationId?: string | null
  signal?: AbortSignal
}): Promise<LiveOrderResult> {
  if (!isFlightSdk(input.sdk) || !input.sdk.createOrder) {
    return { ok: false, error: 'flight_provider_unavailable', errorCode: 'unavailable' }
  }
  return timedOrder(input.sdk, 'createFlightBooking', () =>
    input.sdk.createOrder!(input.offerId, input.signal, {
      travelers: input.travelers,
      conversationId: input.conversationId,
    }),
  )
}

export async function retrieveBooking(input: {
  sdk: LiveProviderSdk
  orderId: string
  signal?: AbortSignal
}): Promise<LiveOrderResult | null> {
  if (!input.sdk.retrieveOrder) return null
  const requestId = createProviderRequestId('ord')
  const started = Date.now()
  const result = await input.sdk.retrieveOrder(input.orderId, input.signal)
  logProviderRequest({
    requestId,
    provider: input.sdk.providerId,
    operation: 'retrieveBooking',
    durationMs: Date.now() - started,
    status: result?.ok ? (result.status ?? 'ok') : 'not_found',
    providerReference: input.orderId,
  })
  return result
}

export async function cancelBooking(input: {
  sdk: LiveProviderSdk
  orderId: string
  signal?: AbortSignal
}): Promise<{ ok: boolean; error?: string; errorCode?: string }> {
  if (!input.sdk.cancelOrder) return { ok: false, error: 'cancel_unsupported', errorCode: 'unavailable' }
  const requestId = createProviderRequestId('ord')
  const started = Date.now()
  const result = await input.sdk.cancelOrder(input.orderId, input.signal)
  logProviderRequest({
    requestId,
    provider: input.sdk.providerId,
    operation: 'cancelBooking',
    durationMs: Date.now() - started,
    status: result.ok ? 'cancelled' : (result.errorCode ?? 'failed'),
    providerReference: input.orderId,
    detail: result.error,
  })
  return result
}

export async function createHotelBooking(input: {
  sdk: LiveProviderSdk
  offerId: string
  travelers?: LiveOrderContext['travelers']
  conversationId?: string | null
  checkIn?: string | null
  checkOut?: string | null
  roomType?: string | null
  signal?: AbortSignal
}): Promise<LiveOrderResult> {
  if (!isHotelSdk(input.sdk) || !input.sdk.createOrder) {
    return { ok: false, error: 'hotel_provider_unavailable', errorCode: 'unavailable' }
  }
  return timedOrder(input.sdk, 'createHotelBooking', () =>
    input.sdk.createOrder!(input.offerId, input.signal, {
      travelers: input.travelers,
      conversationId: input.conversationId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      roomType: input.roomType,
    }),
  )
}

export async function retrieveHotelBooking(input: {
  sdk: LiveProviderSdk
  orderId: string
  signal?: AbortSignal
}): Promise<LiveOrderResult | null> {
  return retrieveBooking(input)
}

export async function cancelHotelBooking(input: {
  sdk: LiveProviderSdk
  orderId: string
  signal?: AbortSignal
}): Promise<{ ok: boolean; error?: string; errorCode?: string }> {
  return cancelBooking(input)
}
