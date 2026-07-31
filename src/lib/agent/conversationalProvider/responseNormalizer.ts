/**
 * Sprint 80 P1-3 — Response Normalizer.
 * Provider / tool payloads → UnifiedProviderOffer[] + passthrough toolData.
 */

import type {
  ConversationalProviderDomain,
  ConversationalProviderId,
  ConversationalProviderMode,
  ConversationalToolSearchResult,
  UnifiedProviderOffer,
  UnifiedProviderSearchResult,
} from './types'

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function offerFromFlightRow(
  row: Record<string, unknown>,
  providerId: ConversationalProviderId,
  index: number,
): UnifiedProviderOffer {
  const id = String(row.id ?? `flight_${index}`)
  const airline = String(row.airline ?? '')
  const from = String(row.from ?? row.origin ?? '')
  const to = String(row.to ?? row.destination ?? '')
  const price = typeof row.price === 'number' ? row.price : null
  const currency = String(row.currency ?? 'SAR')
  return {
    id,
    domain: 'flights',
    providerId,
    title: [airline, from && to ? `${from}→${to}` : '', price != null ? `${price} ${currency}` : '']
      .filter(Boolean)
      .join(' · '),
    price,
    currency,
    score: typeof row.score === 'number' ? row.score : undefined,
    raw: row,
  }
}

function offerFromHotelRow(
  row: Record<string, unknown>,
  providerId: ConversationalProviderId,
  index: number,
): UnifiedProviderOffer {
  const id = String(row.hotelId ?? row.id ?? `hotel_${index}`)
  const name = String(row.name ?? row.hotelName ?? 'Hotel')
  const price = typeof row.nightly === 'number'
    ? row.nightly
    : typeof row.pricePerNight === 'number'
      ? row.pricePerNight
      : typeof row.total === 'number'
        ? row.total
        : null
  const currency = String(row.currency ?? 'SAR')
  return {
    id,
    domain: 'hotels',
    providerId,
    title: [name, price != null ? `${price} ${currency}` : ''].filter(Boolean).join(' · '),
    price,
    currency,
    score: typeof row.score === 'number' ? row.score : undefined,
    raw: row,
  }
}

function offerFromGenericRow(
  row: Record<string, unknown>,
  domain: ConversationalProviderDomain,
  providerId: ConversationalProviderId,
  index: number,
): UnifiedProviderOffer {
  const id = String(row.id ?? `${domain}_${index}`)
  const title = String(row.title ?? row.name ?? id)
  const price = typeof row.price === 'number' ? row.price : null
  const currency = String(row.currency ?? 'SAR')
  return {
    id,
    domain,
    providerId,
    title,
    price,
    currency,
    score: typeof row.score === 'number' ? row.score : undefined,
    raw: row,
  }
}

/** Normalize existing tool-bridge payloads into UnifiedProviderOffer[]. */
export function normalizeToolSearchResultToOffers(
  domain: ConversationalProviderDomain,
  providerId: ConversationalProviderId,
  tool: ConversationalToolSearchResult,
): UnifiedProviderOffer[] {
  const data = tool.data
  if (domain === 'flights') {
    const offers = Array.isArray(data.offers) ? data.offers : []
    return offers.map((row, i) => offerFromFlightRow(asRecord(row), providerId, i))
  }
  if (domain === 'hotels') {
    const stays = Array.isArray(data.stays) ? data.stays : []
    return stays.map((row, i) => offerFromHotelRow(asRecord(row), providerId, i))
  }
  const items = Array.isArray(data.offers)
    ? data.offers
    : Array.isArray(data.items)
      ? data.items
      : []
  return items.map((row, i) => offerFromGenericRow(asRecord(row), domain, providerId, i))
}

export function normalizeToUnifiedSearchResult(input: {
  domain: ConversationalProviderDomain
  providerId: ConversationalProviderId
  mode: ConversationalProviderMode
  tool: ConversationalToolSearchResult
  latencyMs: number
  error?: string
  errorCode?: UnifiedProviderSearchResult['errorCode']
  ok?: boolean
}): UnifiedProviderSearchResult {
  const offers = normalizeToolSearchResultToOffers(
    input.domain,
    input.providerId,
    input.tool,
  )
  const empty = input.tool.empty || offers.length === 0
  return {
    ok: input.ok ?? (input.error == null),
    domain: input.domain,
    providerId: input.providerId,
    mode: input.mode,
    offers,
    empty,
    latencyMs: input.latencyMs,
    toolData: {
      ...input.tool.data,
      conversationalProvider: {
        providerId: input.providerId,
        domain: input.domain,
        mode: input.mode,
        unifyVersion: '1.0.0-conversational-provider-unify',
      },
    },
    gracefulMessage: input.tool.gracefulMessage,
    error: input.error,
    errorCode: input.errorCode ?? (empty && input.ok !== false ? 'EMPTY_INVENTORY' : undefined),
  }
}

/** Convert unified result back to the tool-bridge return shape. */
export function unifiedResultToToolSearchResult(
  result: UnifiedProviderSearchResult,
): ConversationalToolSearchResult {
  return {
    data: result.toolData,
    empty: result.empty,
    gracefulMessage: result.gracefulMessage,
  }
}
