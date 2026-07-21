/**
 * Sprint 63 — document metadata helpers + duplicate detection keys.
 */

import type { EnterpriseDocument, EnterpriseDocumentType } from './types'

export function buildDuplicateKey(input: {
  documentType: EnterpriseDocumentType
  tripId?: string | null
  bookingId?: string | null
  providerId?: string | null
  travelerId?: string | null
  providerReference?: string | null
  checksum?: string | null
}): string {
  return [
    input.documentType,
    input.tripId ?? '',
    input.bookingId ?? '',
    input.providerId ?? '',
    input.travelerId ?? '',
    input.providerReference ?? '',
    input.checksum ?? '',
  ].join('|')
}

export function findDuplicate(
  existing: EnterpriseDocument[],
  candidate: {
    documentType: EnterpriseDocumentType
    tripId?: string | null
    bookingId?: string | null
    providerId?: string | null
    travelerId?: string | null
    providerReference?: string | null
    checksum: string
  },
): EnterpriseDocument | null {
  const key = buildDuplicateKey(candidate)
  for (const doc of existing) {
    if (doc.status === 'deleted' || doc.status === 'superseded') continue
    const other = buildDuplicateKey({
      documentType: doc.documentType,
      tripId: doc.tripId,
      bookingId: doc.bookingId,
      providerId: doc.providerId,
      travelerId: doc.travelerId,
      providerReference: doc.providerReference,
      checksum: doc.checksum,
    })
    if (other === key) return doc
  }
  return null
}

export function defaultMimeType(type: EnterpriseDocumentType): string {
  switch (type) {
    case 'E_TICKET':
    case 'BOARDING_PASS':
    case 'HOTEL_VOUCHER':
    case 'HOTEL_CONFIRMATION':
    case 'INVOICE':
    case 'RECEIPT':
    case 'INSURANCE':
    case 'VISA':
    case 'ITINERARY':
      return 'application/pdf'
    case 'PASSPORT':
      return 'application/json'
    case 'CUSTOM':
    default:
      return 'application/octet-stream'
  }
}

export function isExpired(doc: EnterpriseDocument, nowMs: number): boolean {
  if (doc.status === 'expired') return true
  if (!doc.expiresAt) return false
  const t = Date.parse(doc.expiresAt)
  return !Number.isNaN(t) && t < nowMs
}
