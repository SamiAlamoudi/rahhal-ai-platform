/**
 * Sprint 63 — document search, filters, sorting.
 */

import { isExpired } from './metadata'
import type {
  DocumentSearchQuery,
  DocumentSortMode,
  EnterpriseDocument,
} from './types'

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

export function matchesDocumentSearch(
  doc: EnterpriseDocument,
  query: DocumentSearchQuery,
  now: () => number = Date.now,
): boolean {
  if (doc.status === 'deleted') return false
  if (query.travelerId && doc.travelerId !== query.travelerId) return false
  if (query.bookingId && doc.bookingId !== query.bookingId) return false
  if (query.tripId && doc.tripId !== query.tripId) return false
  if (query.providerId && doc.providerId !== query.providerId) return false
  if (query.documentType && doc.documentType !== query.documentType) return false
  if (query.date) {
    const d = query.date.slice(0, 10)
    if (doc.createdAt.slice(0, 10) !== d) return false
  }
  const nowMs = now()
  const expired = isExpired(doc, nowMs)
  if (query.expired === true && !expired) return false
  if (query.expired === false && expired) return false
  if (query.active === true && (doc.status !== 'active' || expired)) return false
  if (query.active === false && doc.status === 'active' && !expired) return false
  if (query.text) {
    const q = norm(query.text)
    const hay = [
      doc.title,
      doc.documentType,
      doc.providerId,
      doc.providerReference,
      doc.travelerId,
      doc.metadata.notes,
      ...(doc.metadata.labels ?? []),
    ]
      .map(norm)
      .join(' ')
    if (!hay.includes(q)) return false
  }
  return true
}

export function searchDocuments(
  docs: EnterpriseDocument[],
  query: DocumentSearchQuery,
  now?: () => number,
): EnterpriseDocument[] {
  return docs.filter((d) => matchesDocumentSearch(d, query, now))
}

export function sortDocuments(
  docs: EnterpriseDocument[],
  mode: DocumentSortMode,
): EnterpriseDocument[] {
  const copy = [...docs]
  switch (mode) {
    case 'newest':
      return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    case 'oldest':
      return copy.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    case 'type':
      return copy.sort((a, b) => a.documentType.localeCompare(b.documentType))
    case 'traveler':
      return copy.sort((a, b) => (a.travelerId ?? '').localeCompare(b.travelerId ?? ''))
    case 'provider':
      return copy.sort((a, b) => (a.providerId ?? '').localeCompare(b.providerId ?? ''))
    case 'expiry':
      return copy.sort((a, b) => {
        const ae = a.expiresAt ? Date.parse(a.expiresAt) : Number.POSITIVE_INFINITY
        const be = b.expiresAt ? Date.parse(b.expiresAt) : Number.POSITIVE_INFINITY
        return ae - be
      })
    default:
      return copy
  }
}

export function filterExpired(
  docs: EnterpriseDocument[],
  now: () => number = Date.now,
): EnterpriseDocument[] {
  const nowMs = now()
  return docs.filter((d) => isExpired(d, nowMs))
}

export function filterActive(
  docs: EnterpriseDocument[],
  now: () => number = Date.now,
): EnterpriseDocument[] {
  const nowMs = now()
  return docs.filter((d) => d.status === 'active' && !isExpired(d, nowMs))
}
