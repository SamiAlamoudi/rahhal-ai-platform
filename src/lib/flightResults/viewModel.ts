import type { FlightSegment } from '../../utils/contracts/models/flight'
import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import { airlineLogoUrl, extractAirlineCode } from './airlineLogo'
import type { FlightResultViewModel } from './types'

function attrString(option: NormalizedTravelOption, key: string): string {
  const value = option.attributes[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function parseSegments(option: NormalizedTravelOption): FlightSegment[] {
  const raw = option.attributes.segments
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter((row): row is FlightSegment => {
    if (!row || typeof row !== 'object') return false
    const seg = row as FlightSegment
    return Boolean(seg.origin && seg.destination && seg.departure && seg.arrival)
  })
}

export function toFlightResultViewModel(option: NormalizedTravelOption): FlightResultViewModel {
  const airlineName = attrString(option, 'airline') || attrString(option, 'providerName') || 'Airline'
  const flightNumber = attrString(option, 'flightNumber')
  const airlineCode = extractAirlineCode(airlineName, flightNumber)
  const segments = parseSegments(option)

  return {
    id: option.id,
    option,
    airlineName,
    airlineCode,
    logoUrl: airlineLogoUrl(airlineCode),
    origin: attrString(option, 'origin') || segments[0]?.origin || '—',
    destination:
      attrString(option, 'destination')
      || segments[segments.length - 1]?.destination
      || '—',
    departureTime: attrString(option, 'departureTime') || segments[0]?.departure || '',
    arrivalTime:
      attrString(option, 'arrivalTime')
      || segments[segments.length - 1]?.arrival
      || '',
    durationMinutes: option.durationMinutes,
    stops: option.stops,
    cabin: attrString(option, 'cabin') || segments[0]?.cabin || 'economy',
    price: option.price,
    currency: option.currency,
    segments,
    baggageIncluded:
      typeof option.attributes.baggageIncluded === 'boolean'
        ? option.attributes.baggageIncluded
        : option.baggageIncluded,
    refundable:
      typeof option.attributes.refundable === 'boolean'
        ? option.attributes.refundable
        : option.refundable,
    cancellationPolicy: (() => {
      const fromAttr = attrString(option, 'cancellationPolicy')
      return fromAttr || null
    })(),
    fareFamily: attrString(option, 'fareFamily') || segments[0]?.fareFamily || null,
    bookingClass: attrString(option, 'bookingClass') || segments[0]?.bookingClass || null,
    aircraft: attrString(option, 'aircraft') || segments[0]?.aircraft || null,
  }
}

export function onlyFlights(options: NormalizedTravelOption[]): NormalizedTravelOption[] {
  return options.filter((o) => o.type === 'flight')
}

export function formatFlightTime(iso: string): string {
  if (!iso) return '—'
  const match = iso.match(/T(\d{2}:\d{2})/)
  if (match) return match[1]
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function formatFlightDuration(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

export function stopsLabel(stops: number | null, locale: 'ar' | 'en' = 'en'): string {
  if (stops == null) return locale === 'ar' ? '—' : '—'
  if (stops === 0) return locale === 'ar' ? 'مباشر' : 'Nonstop'
  if (stops === 1) return locale === 'ar' ? 'توقف واحد' : '1 stop'
  return locale === 'ar' ? `${stops} توقفات` : `${stops} stops`
}
