/**
 * Sprint 104 — map TravelProvider search results → unified GatewayOffer[].
 */

import type { ProviderSearchResult } from '../providers'
import type { GatewayOffer, GatewayProviderId } from './types'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

export function mapProviderSearchResult(
  providerId: GatewayProviderId,
  kind: GatewayOffer['kind'],
  result: ProviderSearchResult,
): GatewayOffer[] {
  return result.results.map((raw, index) => {
    const row = (raw && typeof raw === 'object')
      ? raw as Record<string, unknown>
      : { value: raw }
    const id = str(row.id) ?? `${providerId}_${kind}_${index}`
    const title = str(row.title)
      ?? str(row.airline)
      ?? str(row.name)
      ?? `${kind} ${id}`
    const price = num(row.price) ?? num(row.totalPrice) ?? num(row.total)
    const currency = (str(row.currency) ?? 'SAR').toUpperCase()
    return {
      id,
      providerId,
      kind,
      title,
      price,
      currency,
      raw: row,
    }
  })
}
