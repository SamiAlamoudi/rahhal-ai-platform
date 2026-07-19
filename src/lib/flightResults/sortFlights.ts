import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { FlightSortKey } from './types'

function departureMs(option: NormalizedTravelOption): number {
  const raw = option.attributes.departureTime
  if (typeof raw !== 'string' || !raw) return Number.POSITIVE_INFINITY
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

/**
 * Sort flight options. Non-flights are stable-sorted after flights when mixed.
 */
export function sortFlights(
  options: NormalizedTravelOption[],
  sortKey: FlightSortKey,
): NormalizedTravelOption[] {
  const flights = options.filter((o) => o.type === 'flight')
  const others = options.filter((o) => o.type !== 'flight')
  const sorted = [...flights]

  switch (sortKey) {
    case 'cheapest':
      sorted.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
      break
    case 'fastest':
      sorted.sort(
        (a, b) =>
          (a.durationMinutes ?? Number.POSITIVE_INFINITY)
          - (b.durationMinutes ?? Number.POSITIVE_INFINITY)
          || a.price - b.price,
      )
      break
    case 'earliest_departure':
      sorted.sort((a, b) => departureMs(a) - departureMs(b) || a.price - b.price)
      break
    case 'latest_departure':
      sorted.sort((a, b) => departureMs(b) - departureMs(a) || a.price - b.price)
      break
    case 'best':
    default:
      sorted.sort(
        (a, b) =>
          (b.decisionScore?.weightedAverage ?? 0) - (a.decisionScore?.weightedAverage ?? 0)
          || a.price - b.price,
      )
      break
  }

  return [...sorted, ...others]
}
