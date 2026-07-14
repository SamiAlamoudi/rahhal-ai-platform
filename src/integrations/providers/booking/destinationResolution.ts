import type { ProviderError } from '../../../utils/contracts/result'
import type {
  BookingComApiClient,
  BookingComDestinationResult,
  ResolvedBookingDestination,
} from './bookingComApiClient'

export type BookingDestType = ResolvedBookingDestination['destType']

export interface DestinationResolveResult {
  destination: ResolvedBookingDestination | null
  error: ProviderError | null
  latency: number
}

/**
 * Arabic / alternate labels → English query for Booking.com searchDestination.
 * This is localization only — not destination IDs or credentials.
 */
const DESTINATION_QUERY_ALIASES: Record<string, string> = {
  'طوكيو': 'Tokyo',
  'tokyo': 'Tokyo',
  'اليابان': 'Tokyo',
  'japan': 'Tokyo',
  'دبي': 'Dubai',
  'dubai': 'Dubai',
  'الرياض': 'Riyadh',
  'riyadh': 'Riyadh',
  'جدة': 'Jeddah',
  'jeddah': 'Jeddah',
  'مكة': 'Mecca',
  'مكه': 'Mecca',
  'المدينة': 'Medina',
  'المدينه': 'Medina',
  'القاهرة': 'Cairo',
  'cairo': 'Cairo',
  'اسطنبول': 'Istanbul',
  'istanbul': 'Istanbul',
  'لندن': 'London',
  'london': 'London',
  'باريس': 'Paris',
  'paris': 'Paris',
  'نيويورك': 'New York',
  'new york': 'New York',
}

const DEST_TYPE_PRIORITY: BookingDestType[] = [
  'city',
  'region',
  'district',
  'airport',
  'landmark',
  'hotel',
]

export function normalizeDestinationQuery(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const alias = DESTINATION_QUERY_ALIASES[trimmed.toLowerCase()]
    ?? DESTINATION_QUERY_ALIASES[trimmed]
  return alias ?? trimmed
}

/** If the UI already provides a numeric Booking dest_id, use it directly. */
export function parseNumericDestId(raw: string): number | null {
  const trimmed = raw.trim()
  if (!/^-?\d+$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function mapDestType(raw: string | undefined | null): BookingDestType {
  const value = (raw ?? 'city').toLowerCase().trim()
  if (value.includes('airport')) return 'airport'
  if (value.includes('landmark') || value.includes('attraction')) return 'landmark'
  if (value.includes('district') || value.includes('neighborhood')) return 'district'
  if (value.includes('region') || value.includes('province') || value.includes('country')) return 'region'
  if (value.includes('hotel') || value.includes('property')) return 'hotel'
  return 'city'
}

export function pickBestDestination(
  results: BookingComDestinationResult[],
  query: string,
): ResolvedBookingDestination | null {
  if (results.length === 0) return null

  const ranked = [...results].sort((a, b) => {
    const aType = mapDestType(a.search_type ?? a.dest_type ?? a.type)
    const bType = mapDestType(b.search_type ?? b.dest_type ?? b.type)
    return DEST_TYPE_PRIORITY.indexOf(aType) - DEST_TYPE_PRIORITY.indexOf(bType)
  })

  const best = ranked[0]
  const destId = Number(best.dest_id)
  if (!Number.isFinite(destId)) return null

  const label = best.label
    || best.city_name
    || best.name
    || query

  return {
    destId,
    destType: mapDestType(best.search_type ?? best.dest_type ?? best.type),
    label,
    query,
  }
}

/**
 * Resolve a free-text destination to a Booking.com dest_id.
 * Returns an error (no hard-coded city fallback) when lookup fails —
 * callers should surface that so HotelService can mock-fallback.
 */
export async function resolveBookingDestination(
  client: BookingComApiClient,
  destination: string,
): Promise<DestinationResolveResult> {
  const raw = destination.trim()
  if (!raw) {
    return {
      destination: null,
      error: {
        code: 'BOOKING_DEST_EMPTY',
        category: 'validation',
        severity: 'warning',
        message: 'Destination is empty',
        retryable: false,
        timestamp: new Date().toISOString(),
      },
      latency: 0,
    }
  }

  const numericId = parseNumericDestId(raw)
  if (numericId !== null) {
    return {
      destination: {
        destId: numericId,
        destType: 'city',
        label: raw,
        query: raw,
      },
      error: null,
      latency: 0,
    }
  }

  const query = normalizeDestinationQuery(raw)
  const result = await client.searchDestination(query)

  if (result.error || !result.data) {
    return {
      destination: null,
      error: result.error ?? {
        code: 'BOOKING_DEST_LOOKUP_FAILED',
        category: 'provider',
        severity: 'error',
        message: `Could not resolve destination "${raw}"`,
        retryable: true,
        timestamp: new Date().toISOString(),
      },
      latency: result.latency,
    }
  }

  const picked = pickBestDestination(result.data, query)
  if (!picked) {
    return {
      destination: null,
      error: {
        code: 'BOOKING_DEST_NOT_FOUND',
        category: 'provider',
        severity: 'warning',
        message: `No Booking.com destination matched "${raw}"`,
        retryable: false,
        timestamp: new Date().toISOString(),
      },
      latency: result.latency,
    }
  }

  return { destination: picked, error: null, latency: result.latency }
}
