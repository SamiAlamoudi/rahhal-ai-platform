import type { ProviderError } from '../../../utils/contracts/result'
import type { AmadeusFlightApiClient, AmadeusLocationResult } from './amadeusFlightApiClient'

export interface ResolvedAirport {
  iataCode: string
  name: string
  subType: 'CITY' | 'AIRPORT'
  query: string
}

export interface AirportResolveResult {
  airport: ResolvedAirport | null
  error: ProviderError | null
  latency: number
  source: 'iata' | 'alias' | 'amadeus' | 'none'
}

/**
 * Arabic / alternate city labels → IATA city or airport codes.
 * Localization only — not API credentials.
 */
const AIRPORT_ALIASES: Record<string, string> = {
  // Saudi Arabia
  'الرياض': 'RUH',
  'riyadh': 'RUH',
  'جدة': 'JED',
  'jeddah': 'JED',
  'جده': 'JED',
  'الدمام': 'DMM',
  'dammam': 'DMM',
  'المدينة': 'MED',
  'المدينه': 'MED',
  'medina': 'MED',
  'مكة': 'JED',
  'مكه': 'JED',
  'mecca': 'JED',
  'القصيم': 'ELQ',
  // UAE / GCC
  'دبي': 'DXB',
  'dubai': 'DXB',
  'ابوظبي': 'AUH',
  'أبوظبي': 'AUH',
  'abu dhabi': 'AUH',
  'الدوحة': 'DOH',
  'doha': 'DOH',
  'الكويت': 'KWI',
  'kuwait': 'KWI',
  // Japan / Asia
  'طوكيو': 'TYO',
  'tokyo': 'TYO',
  'اليابان': 'TYO',
  'japan': 'TYO',
  'اوساكا': 'OSA',
  'أوساكا': 'OSA',
  'osaka': 'OSA',
  // Europe / other common
  'لندن': 'LON',
  'london': 'LON',
  'باريس': 'PAR',
  'paris': 'PAR',
  'اسطنبول': 'IST',
  'istanbul': 'IST',
  'القاهرة': 'CAI',
  'cairo': 'CAI',
  'نيويورك': 'NYC',
  'new york': 'NYC',
}

const IATA_RE = /^[A-Za-z]{3}$/

export function parseValidIata(raw: string): string | null {
  const trimmed = raw.trim()
  if (!IATA_RE.test(trimmed)) return null
  return trimmed.toUpperCase()
}

export function normalizeAirportQuery(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return AIRPORT_ALIASES[trimmed.toLowerCase()]
    ?? AIRPORT_ALIASES[trimmed]
    ?? trimmed
}

export function resolveAirportAlias(raw: string): ResolvedAirport | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const direct = parseValidIata(trimmed)
  if (direct) {
    return { iataCode: direct, name: direct, subType: 'CITY', query: trimmed }
  }

  const alias = AIRPORT_ALIASES[trimmed.toLowerCase()] ?? AIRPORT_ALIASES[trimmed]
  if (alias) {
    return { iataCode: alias, name: trimmed, subType: 'CITY', query: trimmed }
  }

  return null
}

export function pickBestLocation(
  results: AmadeusLocationResult[],
  query: string,
): ResolvedAirport | null {
  if (results.length === 0) return null

  const ranked = [...results].sort((a, b) => {
    const score = (item: AmadeusLocationResult) => {
      if (item.subType === 'CITY') return 0
      if (item.subType === 'AIRPORT') return 1
      return 2
    }
    return score(a) - score(b)
  })

  const best = ranked[0]
  const code = (best.iataCode || '').toUpperCase()
  if (!IATA_RE.test(code)) return null

  return {
    iataCode: code,
    name: best.name || best.address?.cityName || query,
    subType: best.subType === 'AIRPORT' ? 'AIRPORT' : 'CITY',
    query,
  }
}

/**
 * Resolve a free-text city / airport name to an IATA code.
 * Prefers local alias / valid IATA; optionally calls Amadeus Locations API.
 * Fails closed (no RUH/NRT hard-code) when unresolved.
 */
export async function resolveAirportCode(
  client: AmadeusFlightApiClient,
  place: string,
  options: { allowRemoteLookup?: boolean } = {},
): Promise<AirportResolveResult> {
  const raw = place.trim()
  if (!raw) {
    return {
      airport: null,
      error: {
        code: 'AMADEUS_AIRPORT_EMPTY',
        category: 'validation',
        severity: 'warning',
        message: 'Airport / city query is empty',
        retryable: false,
        timestamp: new Date().toISOString(),
      },
      latency: 0,
      source: 'none',
    }
  }

  const local = resolveAirportAlias(raw)
  if (local) {
    return { airport: local, error: null, latency: 0, source: parseValidIata(raw) ? 'iata' : 'alias' }
  }

  if (options.allowRemoteLookup === false) {
    return {
      airport: null,
      error: {
        code: 'AMADEUS_AIRPORT_NOT_FOUND',
        category: 'validation',
        severity: 'warning',
        message: `No local IATA mapping for "${raw}"`,
        retryable: false,
        timestamp: new Date().toISOString(),
      },
      latency: 0,
      source: 'none',
    }
  }

  const keyword = normalizeAirportQuery(raw)
  const result = await client.searchLocations(keyword)

  if (result.error || !result.data) {
    return {
      airport: null,
      error: result.error ?? {
        code: 'AMADEUS_AIRPORT_LOOKUP_FAILED',
        category: 'provider',
        severity: 'error',
        message: `Could not resolve airport/city "${raw}"`,
        retryable: true,
        timestamp: new Date().toISOString(),
      },
      latency: result.latency,
      source: 'none',
    }
  }

  const picked = pickBestLocation(result.data, keyword)
  if (!picked) {
    return {
      airport: null,
      error: {
        code: 'AMADEUS_AIRPORT_NOT_FOUND',
        category: 'provider',
        severity: 'warning',
        message: `No Amadeus location matched "${raw}"`,
        retryable: false,
        timestamp: new Date().toISOString(),
      },
      latency: result.latency,
      source: 'none',
    }
  }

  return { airport: picked, error: null, latency: result.latency, source: 'amadeus' }
}
