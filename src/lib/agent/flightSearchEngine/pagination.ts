/**
 * Sprint 72 — Cursor-based pagination (no Buffer dependency for browser builds).
 */

import type { UnifiedFlight } from './types'

export type FlightCursorPayload = {
  offset: number
}

function encodeBase64Url(text: string): string {
  try {
    const buf = (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } }).Buffer
    if (buf) return buf.from(text, 'utf8').toString('base64url')
  } catch {
    /* fall through */
  }
  const b64 = btoa(text)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(text: string): string {
  try {
    const buf = (globalThis as { Buffer?: { from(s: string, e: string): { toString(e: string): string } } }).Buffer
    if (buf) return buf.from(text, 'base64url').toString('utf8')
  } catch {
    /* fall through */
  }
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return atob(padded + pad)
}

export function encodeFlightCursor(offset: number): string {
  const payload: FlightCursorPayload = { offset: Math.max(0, offset) }
  return encodeBase64Url(JSON.stringify(payload))
}

export function decodeFlightCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  try {
    const json = decodeBase64Url(cursor)
    const parsed = JSON.parse(json) as FlightCursorPayload
    return typeof parsed.offset === 'number' && parsed.offset >= 0 ? parsed.offset : 0
  } catch {
    return 0
  }
}

export function paginateFlights(
  flights: UnifiedFlight[],
  pageSize: number,
  cursor?: string | null,
): { page: UnifiedFlight[]; nextCursor: string | null; hasMore: boolean; total: number } {
  const size = Math.max(1, Math.min(pageSize, 100))
  const offset = decodeFlightCursor(cursor)
  const page = flights.slice(offset, offset + size)
  const nextOffset = offset + page.length
  const hasMore = nextOffset < flights.length
  return {
    page,
    nextCursor: hasMore ? encodeFlightCursor(nextOffset) : null,
    hasMore,
    total: flights.length,
  }
}
