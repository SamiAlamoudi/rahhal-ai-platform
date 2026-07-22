/**
 * Sprint 120 — Light trip-hint extraction for PipelineInput (no new engine).
 */

import type { PipelineInput, PipelineTripHints } from '../agent/pipeline'

export function extractTripHintsFromText(text: string): PipelineTripHints {
  const trip: PipelineTripHints = {}
  const dest =
    text.match(/\b(?:to|in|إلى)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/)
    || text.match(/(?:destination|وجهة)\s*[:=]?\s*([A-Za-z\u0600-\u06FF][\w\u0600-\u06FF\s]{1,40})/i)
  if (dest?.[1]) trip.destination = dest[1].trim()

  const budget =
    text.match(/(?:SAR|sar)\s*([\d,]+)/)
    || text.match(/([\d,]+)\s*(?:SAR|sar|ريال)/)
  if (budget?.[1]) trip.budget = Number(budget[1].replace(/,/g, ''))

  const adults = text.match(/(\d+)\s*adult/i)
  if (adults) trip.adults = Number(adults[1])
  const children = text.match(/(\d+)\s*child/i)
  if (children) trip.children = Number(children[1])

  if (/business/i.test(text)) trip.cabin = 'business'
  if (/family|عائلي/i.test(text)) trip.style = 'family'
  else if (/business|عمل/i.test(text)) trip.style = 'business'
  else trip.style = 'leisure'

  trip.currency = 'SAR'
  return trip
}

export function buildPipelineInputFromMessage(input: {
  conversationId?: string | null
  userId?: string | null
  text: string
  flights?: Array<Record<string, unknown>> | null
  hotels?: Array<Record<string, unknown>> | null
  tripOverrides?: PipelineTripHints | null
}): PipelineInput {
  const extracted = extractTripHintsFromText(input.text)
  return {
    conversationId: input.conversationId ?? null,
    userId: input.userId ?? null,
    messages: [{ role: 'user', text: input.text }],
    trip: {
      ...extracted,
      ...input.tripOverrides,
    },
    flights: input.flights ?? null,
    hotels: input.hotels ?? null,
  }
}
