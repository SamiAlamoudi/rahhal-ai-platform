/**
 * Sprint 93 — provider result adapters → unified Trip segment types.
 */

import type {
  TripActivity,
  TripFlight,
  TripHotel,
  TripInsurance,
  TripTransfer,
  TripVisa,
} from './types'

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.7
  return n > 1 ? Math.min(1, n / 100) : Math.max(0, Math.min(1, n))
}

export function normalizeFlightProviderResult(
  raw: Record<string, unknown>,
  index: number,
  defaults?: { currency?: string; direction?: TripFlight['direction'] },
): TripFlight {
  const origin = str(raw.origin) ?? str(raw.from) ?? ''
  const destination = str(raw.destination) ?? str(raw.to) ?? ''
  const price = num(raw.price) ?? num(raw.total) ?? 0
  return {
    id: str(raw.id) ?? `flight_${index}`,
    direction: defaults?.direction
      ?? (index === 0 ? 'outbound' : index === 1 ? 'return' : 'unknown'),
    airline: str(raw.airline) ?? str(raw.carrierCode) ?? str(raw.airlineName),
    origin,
    destination,
    departureAt: str(raw.departureAt) ?? str(raw.departure) ?? str(raw.departureDate),
    arrivalAt: str(raw.arrivalAt) ?? str(raw.arrival),
    durationMinutes: num(raw.durationMinutes),
    stops: num(raw.stops) ?? 0,
    cabin: str(raw.cabin),
    price,
    currency: str(raw.currency) ?? defaults?.currency ?? 'SAR',
    refundable: raw.refundable === true ? true : raw.refundable === false ? false : null,
    providerId: str(raw.providerId),
    confidence: clamp01(num(raw.providerConfidence) ?? 0.8),
  }
}

export function normalizeHotelProviderResult(
  raw: Record<string, unknown>,
  index: number,
  defaults?: { currency?: string },
): TripHotel {
  const checkIn = str(raw.checkIn) ?? str(raw.check_in)
  const checkOut = str(raw.checkOut) ?? str(raw.check_out)
  let nights: number | null = num(raw.nights)
  if (nights == null && checkIn && checkOut) {
    const a = Date.parse(checkIn)
    const b = Date.parse(checkOut)
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      nights = Math.round((b - a) / 86_400_000)
    }
  }
  return {
    id: str(raw.id) ?? `hotel_${index}`,
    name: str(raw.name) ?? str(raw.title) ?? `Hotel ${index + 1}`,
    destination: str(raw.destination) ?? str(raw.city),
    checkIn,
    checkOut,
    nights,
    stars: num(raw.stars) ?? num(raw.hotelStars),
    rating: num(raw.rating),
    price: num(raw.price) ?? num(raw.total) ?? 0,
    currency: str(raw.currency) ?? defaults?.currency ?? 'SAR',
    providerId: str(raw.providerId),
    confidence: clamp01(num(raw.providerConfidence) ?? 0.75),
  }
}

export function normalizeActivityProviderResult(
  raw: Record<string, unknown>,
  index: number,
  defaults?: { currency?: string },
): TripActivity {
  return {
    id: str(raw.id) ?? `activity_${index}`,
    title: str(raw.title) ?? str(raw.name) ?? `Activity ${index + 1}`,
    startAt: str(raw.startAt) ?? str(raw.start),
    endAt: str(raw.endAt) ?? str(raw.end),
    price: num(raw.price) ?? num(raw.total) ?? 0,
    currency: str(raw.currency) ?? defaults?.currency ?? 'SAR',
    destination: str(raw.destination),
    providerId: str(raw.providerId),
  }
}

export function normalizeTransferProviderResult(
  raw: Record<string, unknown>,
  index: number,
  defaults?: { currency?: string },
): TripTransfer {
  return {
    id: str(raw.id) ?? `transfer_${index}`,
    title: str(raw.title) ?? str(raw.name) ?? 'Airport transfer',
    from: str(raw.from) ?? str(raw.origin),
    to: str(raw.to) ?? str(raw.destination),
    startAt: str(raw.startAt) ?? str(raw.availableFrom),
    durationMinutes: num(raw.durationMinutes),
    price: num(raw.price) ?? num(raw.total) ?? 0,
    currency: str(raw.currency) ?? defaults?.currency ?? 'SAR',
    providerId: str(raw.providerId),
  }
}

export function normalizeInsuranceProviderResult(
  raw: Record<string, unknown>,
  index: number,
  defaults?: { currency?: string },
): TripInsurance {
  return {
    id: str(raw.id) ?? `insurance_${index}`,
    title: str(raw.title) ?? str(raw.name) ?? 'Travel insurance',
    price: num(raw.price) ?? num(raw.total) ?? 0,
    currency: str(raw.currency) ?? defaults?.currency ?? 'SAR',
    coverage: str(raw.coverage) ?? str(raw.summary),
    providerId: str(raw.providerId),
  }
}

export function normalizeVisaProviderResult(
  raw: Record<string, unknown>,
  index: number,
  defaults?: { currency?: string; destination?: string | null },
): TripVisa {
  return {
    id: str(raw.id) ?? `visa_${index}`,
    required: raw.required === true || raw.required === 'true',
    destination: str(raw.destination) ?? defaults?.destination ?? null,
    summary: str(raw.summary) ?? str(raw.title) ?? 'Visa requirements to be confirmed',
    estimatedFee: num(raw.estimatedFee) ?? num(raw.price) ?? 0,
    currency: str(raw.currency) ?? defaults?.currency ?? 'SAR',
    providerId: str(raw.providerId),
  }
}

/** Map package components into trip segments when dedicated offers are absent. */
export function segmentsFromPackageComponents(
  components: Array<{
    kind: string
    id: string
    title: string
    price: number
    currency: string
    payload: Record<string, unknown>
  }>,
  currency: string,
): {
  flights: TripFlight[]
  hotel: TripHotel | null
  activities: TripActivity[]
  transfers: TripTransfer[]
  insurance: TripInsurance | null
  visa: TripVisa | null
} {
  const flights: TripFlight[] = []
  let hotel: TripHotel | null = null
  const activities: TripActivity[] = []
  const transfers: TripTransfer[] = []
  let insurance: TripInsurance | null = null
  let visa: TripVisa | null = null

  for (const c of components) {
    const raw = { ...c.payload, id: c.id, title: c.title, price: c.price, currency: c.currency }
    if (c.kind === 'flight') {
      flights.push(normalizeFlightProviderResult(raw, flights.length, { currency }))
    } else if (c.kind === 'hotel' && !hotel) {
      hotel = normalizeHotelProviderResult(
        { ...raw, name: c.title },
        0,
        { currency },
      )
    } else if (c.kind === 'activity') {
      activities.push(normalizeActivityProviderResult(raw, activities.length, { currency }))
    } else if (c.kind === 'transfer') {
      transfers.push(normalizeTransferProviderResult(raw, transfers.length, { currency }))
    } else if (c.kind === 'insurance' && !insurance) {
      insurance = normalizeInsuranceProviderResult(raw, 0, { currency })
    } else if (c.kind === 'visa' && !visa) {
      visa = normalizeVisaProviderResult(raw, 0, { currency })
    }
  }

  return { flights, hotel, activities, transfers, insurance, visa }
}
