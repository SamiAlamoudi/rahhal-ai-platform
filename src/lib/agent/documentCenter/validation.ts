/**
 * Sprint 63 — document validation (missing / expired / duplicate / checksum).
 */

import { validateChecksum } from './checksum'
import { isExpired } from './metadata'
import type {
  DocumentValidationReport,
  EnterpriseDocument,
  EnterpriseDocumentType,
} from './types'

const FLIGHT_EXPECTED: EnterpriseDocumentType[] = ['E_TICKET', 'INVOICE', 'RECEIPT']
const HOTEL_EXPECTED: EnterpriseDocumentType[] = ['HOTEL_VOUCHER', 'HOTEL_CONFIRMATION']

export function validateDocuments(input: {
  documents: EnterpriseDocument[]
  tripId?: string
  hasFlights?: boolean
  hasHotels?: boolean
  now?: () => number
}): DocumentValidationReport {
  const nowMs = (input.now ?? Date.now)()
  const docs = input.documents.filter((d) => d.status !== 'deleted')
  const missing: DocumentValidationReport['missing'] = []
  const tripId = input.tripId ?? docs[0]?.tripId ?? 'unknown'

  const types = new Set(
    docs.filter((d) => d.status === 'active' || d.status === 'pending').map((d) => d.documentType),
  )

  if (input.hasFlights) {
    for (const t of FLIGHT_EXPECTED) {
      if (!types.has(t)) {
        missing.push({ tripId, expectedType: t, reason: 'flight_booking_requires_document' })
      }
    }
  }
  if (input.hasHotels) {
    for (const t of HOTEL_EXPECTED) {
      if (!types.has(t)) {
        missing.push({ tripId, expectedType: t, reason: 'hotel_booking_requires_document' })
      }
    }
  }

  const expired = docs.filter((d) => isExpired(d, nowMs))
  const invalidChecksum = docs.filter(
    (d) => d.documentType !== 'PASSPORT' && !validateChecksum(d.contentBody, d.checksum),
  )

  const duplicates: DocumentValidationReport['duplicates'] = []
  const seen = new Map<string, string>()
  for (const d of docs) {
    if (d.status === 'superseded') continue
    const key = [
      d.documentType,
      d.tripId,
      d.bookingId,
      d.providerReference,
      d.checksum,
    ].join('|')
    const prev = seen.get(key)
    if (prev) {
      duplicates.push({ documentId: d.documentId, duplicateOf: prev })
    } else {
      seen.set(key, d.documentId)
    }
  }

  return { missing, expired, duplicates, invalidChecksum }
}
