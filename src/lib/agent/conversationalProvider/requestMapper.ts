/**
 * Sprint 80 P1-3 — Request Mapper.
 * AgentToolContext / opaque criteria → UnifiedProviderRequest.
 *
 * Reuses existing searchEngineBridge builders so mock engine contracts stay identical.
 */

import type { AgentToolContext } from '../tools/types'
import { buildFlightSearchRequest, buildHotelSearchRequest } from '../tools/searchEngineBridge'
import type {
  ConversationalProviderDomain,
  UnifiedProviderRequest,
} from './types'
import { ConversationalProviderError } from './errors'

export type MapRequestOptions = {
  domain: ConversationalProviderDomain
  ctx: AgentToolContext
  requestId?: string
  signal?: AbortSignal
}

/**
 * Map conversation tool context into a unified provider request.
 * Throws ConversationalProviderError(INVALID_REQUEST) for unsupported domains
 * or when existing builders reject incomplete criteria.
 */
export function mapConversationalProviderRequest(
  options: MapRequestOptions,
): UnifiedProviderRequest {
  const { domain, ctx, requestId, signal } = options
  const locale = ctx.locale === 'en' ? 'en' : 'ar'

  try {
    if (domain === 'flights') {
      const engineReq = buildFlightSearchRequest(ctx)
      return {
        domain: 'flights',
        criteria: { ...engineReq } as Record<string, unknown>,
        currency: engineReq.currency,
        adults: engineReq.adults,
        children: engineReq.children,
        locale,
        signal: signal ?? engineReq.signal,
        requestId,
      }
    }

    if (domain === 'hotels') {
      const engineReq = buildHotelSearchRequest(ctx)
      return {
        domain: 'hotels',
        criteria: { ...engineReq } as Record<string, unknown>,
        currency: engineReq.currency,
        adults: engineReq.adults,
        children: engineReq.children,
        locale,
        signal: signal ?? engineReq.signal,
        requestId,
      }
    }

    // Future domains — accept opaque input until dedicated builders exist.
    return {
      domain,
      criteria: { ...ctx.input },
      currency: typeof ctx.input?.currency === 'string'
        ? ctx.input.currency
        : (ctx.requirements.budgetCurrency ?? 'SAR'),
      adults: typeof ctx.requirements.travelers === 'number'
        ? ctx.requirements.travelers
        : undefined,
      locale,
      signal,
      requestId,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new ConversationalProviderError({
      code: 'INVALID_REQUEST',
      message,
      providerId: `mapper-${domain}`,
      retryable: false,
      cause: err,
    })
  }
}

/** Extract a stable cache / diagnostics key from a unified request. */
export function conversationalRequestFingerprint(request: UnifiedProviderRequest): string {
  const origin = String(request.criteria.origin ?? '')
  const destination = String(
    request.criteria.destination
    ?? request.criteria.city
    ?? request.criteria.destinationCity
    ?? '',
  )
  const date = String(
    request.criteria.departureDate
    ?? request.criteria.checkIn
    ?? '',
  )
  return [
    request.domain,
    origin,
    destination,
    date,
    String(request.adults ?? ''),
    String(request.currency ?? ''),
  ].join('|')
}
