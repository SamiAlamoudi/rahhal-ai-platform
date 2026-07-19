import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { FlightFilterState, TimeOfDayWindow } from './types'

export function isInTimeWindow(iso: string | undefined, window: TimeOfDayWindow): boolean {
  if (window === 'any') return true
  if (!iso) return false
  const match = iso.match(/T(\d{2}):/)
  if (!match) return false
  const h = Number.parseInt(match[1], 10)
  if (window === 'morning') return h >= 5 && h < 12
  if (window === 'afternoon') return h >= 12 && h < 18
  return h >= 18 || h < 5
}

function airlineOf(option: NormalizedTravelOption): string {
  const value = option.attributes.airline
  return typeof value === 'string' ? value : ''
}

function cabinOf(option: NormalizedTravelOption): string {
  const value = option.attributes.cabin
  return typeof value === 'string' ? value.toLowerCase() : ''
}

/**
 * Reusable flight filter — pure, provider-agnostic.
 * Non-flight options pass through unchanged.
 */
export function filterFlights(
  options: NormalizedTravelOption[],
  filters: FlightFilterState,
): NormalizedTravelOption[] {
  return options.filter((option) => {
    if (option.type !== 'flight') return true

    if (filters.maxPrice != null && option.price > filters.maxPrice) return false

    const stops = option.stops ?? 0
    if (filters.stops === 'nonstop' && stops !== 0) return false
    if (filters.stops === 'max1' && stops > 1) return false
    if (filters.stops === 'max2' && stops > 2) return false

    if (filters.airlines.length > 0) {
      const airline = airlineOf(option).toLowerCase()
      const hit = filters.airlines.some((a) => a.toLowerCase() === airline)
      if (!hit) return false
    }

    if (filters.cabin !== 'any') {
      if (cabinOf(option) !== filters.cabin) return false
    }

    const dep = typeof option.attributes.departureTime === 'string'
      ? option.attributes.departureTime
      : undefined
    const arr = typeof option.attributes.arrivalTime === 'string'
      ? option.attributes.arrivalTime
      : undefined

    if (!isInTimeWindow(dep, filters.departureWindow)) return false
    if (!isInTimeWindow(arr, filters.arrivalWindow)) return false

    return true
  })
}

export function uniqueAirlines(options: NormalizedTravelOption[]): string[] {
  const set = new Set<string>()
  for (const option of options) {
    if (option.type !== 'flight') continue
    const airline = airlineOf(option)
    if (airline) set.add(airline)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

