/**
 * Sprint 24 — normalize ExecutionResult payloads into typed SearchOptions.
 */

import type {
  ActivitiesSearchPayload,
  ExecutionResult,
  FlightSearchPayload,
  HotelSearchPayload,
  PackageSearchPayload,
  TransportSearchPayload,
} from '../execution/types'
import type {
  ActivityOption,
  FlightOption,
  HotelOption,
  PackageOption,
  SearchOption,
  TransportOption,
} from './types'

export function normalizeExecutionResults(
  results: ExecutionResult[],
): SearchOption[] {
  const out: SearchOption[] = []
  for (const result of results) {
    if (!result.success || !result.data) continue
    out.push(...normalizeOne(result))
  }
  return out
}

function normalizeOne(result: ExecutionResult): SearchOption[] {
  const data = result.data as { kind?: string }
  switch (data?.kind) {
    case 'flights':
      return normalizeFlights(result, data as FlightSearchPayload)
    case 'hotels':
      return normalizeHotels(result, data as HotelSearchPayload)
    case 'transport':
      return normalizeTransport(result, data as TransportSearchPayload)
    case 'activities':
      return normalizeActivities(result, data as ActivitiesSearchPayload)
    case 'packages':
      return normalizePackages(result, data as PackageSearchPayload)
    default:
      return []
  }
}

function normalizeFlights(
  result: ExecutionResult,
  payload: FlightSearchPayload,
): FlightOption[] {
  return (payload.offers ?? []).map((o) => ({
    id: o.id,
    kind: 'flight' as const,
    from: o.from,
    to: o.to,
    airline: o.airline,
    cabin: o.cabin,
    price: o.price,
    currency: o.currency,
    stops: o.stops,
    durationHours: Math.max(1.5, 2.5 + o.stops * 2),
    providerId: result.providerId,
    sourceTaskId: result.taskId,
  }))
}

function normalizeHotels(
  result: ExecutionResult,
  payload: HotelSearchPayload,
): HotelOption[] {
  return (payload.offers ?? []).map((o) => ({
    id: o.id,
    kind: 'hotel' as const,
    name: o.name,
    area: o.area,
    stars: o.stars,
    nightly: o.nightly,
    currency: o.currency,
    providerId: result.providerId,
    sourceTaskId: result.taskId,
  }))
}

function normalizeTransport(
  result: ExecutionResult,
  payload: TransportSearchPayload,
): TransportOption[] {
  return (payload.offers ?? []).map((o) => ({
    id: o.id,
    kind: 'transport' as const,
    mode: o.mode,
    from: o.from,
    to: o.to,
    price: o.price,
    currency: o.currency,
    providerId: result.providerId,
    sourceTaskId: result.taskId,
  }))
}

function normalizeActivities(
  result: ExecutionResult,
  payload: ActivitiesSearchPayload,
): ActivityOption[] {
  return (payload.offers ?? []).map((o) => ({
    id: o.id,
    kind: 'activity' as const,
    title: o.title,
    category: o.category,
    price: o.price,
    currency: o.currency,
    providerId: result.providerId,
    sourceTaskId: result.taskId,
  }))
}

function normalizePackages(
  result: ExecutionResult,
  payload: PackageSearchPayload,
): PackageOption[] {
  return (payload.offers ?? []).map((o) => ({
    id: o.id,
    kind: 'package' as const,
    title: o.title,
    includes: [...o.includes],
    price: o.price,
    currency: o.currency,
    providerId: result.providerId,
    sourceTaskId: result.taskId,
  }))
}

/** Deduplicate by kind+identity keys; keep lower price when conflicting. */
export function deduplicateOptions(options: SearchOption[]): SearchOption[] {
  const byKey = new Map<string, SearchOption>()
  for (const option of options) {
    const key = dedupeKey(option)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, option)
      continue
    }
    if (priceOf(option) < priceOf(existing)) {
      byKey.set(key, option)
    }
  }
  return [...byKey.values()]
}

function dedupeKey(option: SearchOption): string {
  switch (option.kind) {
    case 'flight':
      return `flight:${option.from}:${option.to}:${option.airline}:${option.cabin}:${option.stops}`
    case 'hotel':
      return `hotel:${option.name.toLowerCase()}:${option.area.toLowerCase()}:${option.stars}`
    case 'transport':
      return `transport:${option.mode}:${option.from}:${option.to}`
    case 'activity':
      return `activity:${option.title.toLowerCase()}:${option.category}`
    case 'package':
      return `package:${option.title.toLowerCase()}:${option.includes.join('+')}`
  }
}

function priceOf(option: SearchOption): number {
  switch (option.kind) {
    case 'flight':
    case 'transport':
    case 'activity':
    case 'package':
      return option.price
    case 'hotel':
      return option.nightly
  }
}
