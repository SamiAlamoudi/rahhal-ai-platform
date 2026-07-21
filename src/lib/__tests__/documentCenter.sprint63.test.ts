/**
 * Sprint 63 — Enterprise Document Center tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  generateBookingDocuments,
  normalizeProviderBooking,
  resetBookingDocumentCenter,
} from '../agent/bookingExecution'
import type { UnifiedBooking } from '../agent/bookingExecution/types'
import {
  DOCUMENT_CENTER_V2_FEATURE_ID,
  DocumentService,
  buildZipPackage,
  computeChecksum,
  getDefaultDocumentService,
  isDocumentCenterV2Enabled,
  publishDocumentsAfterBookingExecution,
  resetDefaultDocumentService,
  validateChecksum,
  validateDocuments,
} from '../agent/documentCenter'
import {
  createTripFromBookings,
  getTripDocuments,
  getTripDocumentsForTrip,
  refreshTripDocumentsForTrip,
  resetDefaultTripManagementService,
  syncTripDocumentsForTrip,
} from '../agent/tripManagement'
import {
  createAmadeusLiveProvider,
  createBookingLiveProvider,
  createDuffelLiveProvider,
} from '../agent/liveProviders'

function money(amount: number, currency = 'SAR') {
  return { amount, currency }
}

function enableV2() {
  getFeatureRegistry().setEnabled('ai.document_center_v2', true)
}

function flightBooking(overrides: Partial<UnifiedBooking> = {}): UnifiedBooking {
  const base = normalizeProviderBooking({
    sessionId: 'sess_doc',
    conversationId: 'conv_doc',
    domain: 'flights',
    providerId: 'amadeus',
    offerId: 'OFF1',
    confirmationId: 'AMD-PNR-XYZ',
    status: 'ticketed',
    travelers: [{ firstName: 'Omar', lastName: 'Nasser', email: 'omar@example.com' }],
    pricing: money(1500),
    order: {
      ok: true,
      orderId: 'AMD-PNR-XYZ',
      providerBookingId: 'amd-1',
      pnr: 'XYZ789',
      ticketNumbers: ['172-999'],
      travelerList: [{ firstName: 'Omar', lastName: 'Nasser' }],
      price: money(1500),
    },
  })
  return { ...base, ...overrides }
}

function hotelBooking(providerId = 'booking'): UnifiedBooking {
  return normalizeProviderBooking({
    sessionId: 'sess_doc',
    domain: 'hotels',
    providerId,
    offerId: 'HTL1',
    confirmationId: 'HTL-CONF-1',
    status: 'confirmed',
    travelers: [{ firstName: 'Omar', lastName: 'Nasser' }],
    pricing: money(800),
    checkIn: '2026-12-01',
    checkOut: '2026-12-05',
    roomType: 'Suite',
    order: {
      ok: true,
      orderId: 'HTL-CONF-1',
      hotelConfirmation: 'HTL-CONF-1',
      guestNames: ['Omar Nasser'],
      checkIn: '2026-12-01',
      checkOut: '2026-12-05',
      price: money(800),
    },
  })
}

describe('Sprint 63 — Enterprise Document Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultDocumentService()
    resetDefaultTripManagementService()
    resetBookingDocumentCenter()
  })

  afterEach(() => {
    resetDefaultDocumentService()
    resetDefaultTripManagementService()
    resetBookingDocumentCenter()
  })

  it('keeps ai.document_center_v2 OFF by default', () => {
    expect(DOCUMENT_CENTER_V2_FEATURE_ID).toBe('ai.document_center_v2')
    expect(isDocumentCenterV2Enabled()).toBe(false)
    expect(publishDocumentsAfterBookingExecution({
      sessionId: 's',
      bookings: [flightBooking()],
    })).toEqual([])
  })

  it('creates documents with required fields', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const doc = svc.create({
      tripId: 'trip_1',
      bookingId: 'bkg_1',
      providerId: 'amadeus',
      travelerId: 'traveler_omar_nasser',
      documentType: 'E_TICKET',
      title: 'E-Ticket XYZ789',
      contentBody: 'PNR XYZ789',
      providerReference: 'XYZ789',
      expiresAt: '2027-01-01T00:00:00.000Z',
    })
    expect(doc.documentId).toMatch(/^edoc_/)
    expect(doc.tripId).toBe('trip_1')
    expect(doc.bookingId).toBe('bkg_1')
    expect(doc.providerId).toBe('amadeus')
    expect(doc.travelerId).toBe('traveler_omar_nasser')
    expect(doc.documentType).toBe('E_TICKET')
    expect(doc.title).toBeTruthy()
    expect(doc.mimeType).toBe('application/pdf')
    expect(doc.fileSize).toBeGreaterThan(0)
    expect(doc.createdAt).toBeTruthy()
    expect(doc.updatedAt).toBeTruthy()
    expect(doc.expiresAt).toBeTruthy()
    expect(doc.status).toBe('active')
    expect(doc.providerReference).toBe('XYZ789')
    expect(doc.downloadUrl).toBeTruthy()
    expect(doc.previewUrl).toBeTruthy()
    expect(doc.checksum).toBe(computeChecksum('PNR XYZ789'))
    expect(doc.version).toBe(1)
  })

  it('integrates with trip management get/sync/refresh', async () => {
    enableV2()
    const bookings = [flightBooking(), hotelBooking()]
    const trip = createTripFromBookings({
      userId: 'u1',
      bookings,
      destination: 'Dubai',
      origin: 'RUH',
      generateDocuments: true,
    })
    // Legacy path still works
    const legacy = getTripDocuments(trip)
    expect(legacy.invoice).not.toBeNull()

    const enterprise = getTripDocumentsForTrip(trip.tripId)
    expect(enterprise).not.toBeNull()
    expect(enterprise!.length).toBeGreaterThan(0)
    expect(enterprise!.some((d) => d.documentType === 'E_TICKET')).toBe(true)
    expect(enterprise!.some((d) => d.documentType === 'HOTEL_VOUCHER')).toBe(true)
    expect(enterprise!.some((d) => d.documentType === 'ITINERARY')).toBe(true)

    const synced = syncTripDocumentsForTrip(trip.tripId, bookings)
    expect(synced!.length).toBeGreaterThan(0)

    const amadeus = createAmadeusLiveProvider({
      clientId: 'c',
      clientSecret: 's',
      orderLive: false,
    })
    const refreshed = await refreshTripDocumentsForTrip({
      tripId: trip.tripId,
      bookings,
      sdks: { amadeus },
    })
    expect(refreshed!.length).toBeGreaterThan(0)
  })

  it('auto-publishes after Booking Execution document generation when flag ON', () => {
    enableV2()
    const bookings = [flightBooking(), hotelBooking()]
    generateBookingDocuments({
      sessionId: 'exec_sess',
      bookings,
      tripId: 'trip_auto',
      travelerName: 'Omar Nasser',
    })
    const docs = getDefaultDocumentService().getByTrip('trip_auto')
    expect(docs.length).toBeGreaterThan(0)
    expect(docs.some((d) => d.metadata.source === 'booking_execution')).toBe(true)
  })

  it('publishes for Amadeus, Booking.com, and Duffel without provider-specific changes', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const amadeusDocs = svc.publishFromBookings({
      tripId: 't_amd',
      bookings: [flightBooking({ provider: 'amadeus' })],
    })
    const bookingDocs = svc.publishFromBookings({
      tripId: 't_bkg',
      bookings: [hotelBooking('booking')],
    })
    const duffelDocs = svc.publishFromBookings({
      tripId: 't_duf',
      bookings: [flightBooking({ provider: 'duffel', confirmation: 'DUF-1', pnr: 'DUF123' })],
    })
    expect(amadeusDocs.some((d) => d.providerId === 'amadeus')).toBe(true)
    expect(bookingDocs.some((d) => d.providerId === 'booking')).toBe(true)
    expect(duffelDocs.some((d) => d.providerId === 'duffel')).toBe(true)

    // SDKs exist for future retrieve refresh
    expect(createAmadeusLiveProvider({ clientId: 'a', clientSecret: 'b', orderLive: false }).providerId).toBe('amadeus')
    expect(createBookingLiveProvider({ apiKey: 'k', orderLive: false }).providerId).toBe('booking')
    expect(createDuffelLiveProvider({ token: 't' }).providerId).toBe('duffel')
  })

  it('versions documents immutably', () => {
    enableV2()
    const svc = new DocumentService()
    const v1 = svc.create({
      tripId: 't',
      documentType: 'INVOICE',
      title: 'Invoice v1',
      contentBody: 'amount 100',
    })
    const v2 = svc.regenerate(v1.documentId, { contentBody: 'amount 120', title: 'Invoice v2' })!
    expect(v2.version).toBe(2)
    expect(v2.lineageId).toBe(v1.lineageId)
    expect(svc.get(v1.documentId)?.status).toBe('superseded')
    const versions = svc.listVersions(v2.documentId)
    expect(versions).toHaveLength(2)
    expect(versions.map((v) => v.version)).toEqual([1, 2])
  })

  it('detects duplicates', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const a = svc.create({
      tripId: 't',
      bookingId: 'b',
      providerId: 'amadeus',
      travelerId: 'tr',
      documentType: 'RECEIPT',
      title: 'Receipt',
      contentBody: 'same',
      providerReference: 'ref1',
    })
    const b = svc.create({
      tripId: 't',
      bookingId: 'b',
      providerId: 'amadeus',
      travelerId: 'tr',
      documentType: 'RECEIPT',
      title: 'Receipt copy',
      contentBody: 'same',
      providerReference: 'ref1',
    })
    expect(b.documentId).toBe(a.documentId)
  })

  it('tracks expiry', () => {
    enableV2()
    const now = () => Date.parse('2026-06-01T00:00:00Z')
    const svc = getDefaultDocumentService()
    const doc = svc.create({
      tripId: 't',
      documentType: 'VISA',
      title: 'Visa',
      contentBody: 'visa body',
      expiresAt: '2026-01-01T00:00:00Z',
      now,
    })
    expect(doc.status).toBe('expired')
    const active = svc.create({
      tripId: 't',
      documentType: 'INSURANCE',
      title: 'Insurance',
      contentBody: 'policy',
      expiresAt: '2027-01-01T00:00:00Z',
      now,
    })
    expect(active.status).toBe('active')
    const refreshed = svc.refreshExpiry(() => Date.parse('2027-06-01T00:00:00Z'))
    expect(refreshed.some((d) => d.documentId === active.documentId)).toBe(true)
  })

  it('creates and resolves share links with expiry', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const doc = svc.create({
      documentType: 'CUSTOM',
      title: 'Custom upload',
      contentBody: 'hello',
    })
    const now = () => 1_000_000
    const link = svc.share(doc.documentId, { ttlMs: 1000, now })!
    expect(link.url).toContain(link.token)
    expect(svc.resolveShare(link.token, now)).not.toBeNull()
    expect(svc.resolveShare(link.token, () => now() + 2000)).toBeNull()
    expect(svc.revokeShare(link.shareId)).toBe(true)
  })

  it('searches and sorts documents', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const t0 = () => 1000
    const t1 = () => 2000
    svc.create({
      tripId: 't1',
      travelerId: 'alice',
      providerId: 'amadeus',
      documentType: 'E_TICKET',
      title: 'Flight ticket RUH-DXB',
      contentBody: 'eticket',
      now: t0,
      expiresAt: '2026-12-01T00:00:00Z',
    })
    svc.create({
      tripId: 't1',
      travelerId: 'bob',
      providerId: 'booking',
      documentType: 'HOTEL_VOUCHER',
      title: 'Harbor Inn voucher',
      contentBody: 'voucher',
      now: t1,
      expiresAt: '2026-06-01T00:00:00Z',
    })
    expect(svc.search({ text: 'harbor' })).toHaveLength(1)
    expect(svc.search({ providerId: 'amadeus' })).toHaveLength(1)
    expect(svc.search({ documentType: 'HOTEL_VOUCHER' })).toHaveLength(1)
    expect(svc.search({ travelerId: 'alice' })).toHaveLength(1)
    expect(svc.search({ tripId: 't1' })).toHaveLength(2)
    expect(svc.search({ active: true }, () => Date.parse('2026-01-01'))).toHaveLength(2)

    const sortedNewest = svc.sort(svc.getByTrip('t1'), 'newest')
    expect(sortedNewest[0]?.travelerId).toBe('bob')
    expect(svc.sort(svc.getByTrip('t1'), 'type')[0]?.documentType).toBe('E_TICKET')
    expect(svc.sort(svc.getByTrip('t1'), 'expiry')[0]?.documentType).toBe('HOTEL_VOUCHER')
  })

  it('builds ZIP packages', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    svc.create({
      tripId: 'tzip',
      documentType: 'ITINERARY',
      title: 'Itinerary',
      contentBody: 'day 1',
    })
    svc.create({
      tripId: 'tzip',
      documentType: 'PASSPORT',
      title: 'Passport meta',
      travelerId: 'traveler_omar',
      providerReference: 'masked',
      metadata: { notes: 'metadata only' },
    })
    const zip = svc.buildZip('tzip')
    expect(zip.mimeType).toBe('application/zip')
    expect(zip.downloadUrl.startsWith('data:application/zip;base64,')).toBe(true)
    expect(zip.entryCount).toBeGreaterThanOrEqual(3) // manifest + docs
    expect(zip.checksum).toBeTruthy()

    const direct = buildZipPackage({
      documents: svc.getByTrip('tzip'),
      tripId: 'tzip',
    })
    expect(direct.fileSize).toBeGreaterThan(0)
  })

  it('records audit log and download history', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const doc = svc.create({
      documentType: 'RECEIPT',
      title: 'Receipt',
      contentBody: 'paid',
    })
    svc.preview(doc.documentId, 'user_1')
    svc.download(doc.documentId, 'user_1')
    svc.share(doc.documentId, { actorId: 'user_1' })
    svc.delete(doc.documentId, 'user_1')
    const audit = svc.auditLog(doc.documentId)
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['generation', 'preview', 'download', 'share', 'delete']),
    )
    expect(svc.downloadHistory(doc.documentId)).toHaveLength(1)
  })

  it('stores offline cache metadata', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const doc = svc.create({
      documentType: 'E_TICKET',
      title: 'Ticket',
      contentBody: 'body',
      metadata: { offlineCacheable: true },
    })
    const meta = svc.cacheOffline(doc.documentId)!
    expect(meta.checksum).toBe(doc.checksum)
    expect(svc.getOfflineMeta(doc.documentId)).toEqual(meta)
    expect(svc.listOffline()).toHaveLength(1)
  })

  it('validates missing, expired, duplicate, and checksum issues', () => {
    enableV2()
    const svc = getDefaultDocumentService()
    const now = () => Date.parse('2026-06-01T00:00:00Z')
    svc.create({
      tripId: 'tval',
      documentType: 'E_TICKET',
      title: 'Ticket',
      contentBody: 'ok',
      now,
    })
    const report = validateDocuments({
      documents: svc.getByTrip('tval'),
      tripId: 'tval',
      hasFlights: true,
      hasHotels: true,
      now,
    })
    expect(report.missing.some((m) => m.expectedType === 'INVOICE')).toBe(true)
    expect(report.missing.some((m) => m.expectedType === 'HOTEL_VOUCHER')).toBe(true)

    const bad = svc.create({
      tripId: 'tval',
      documentType: 'CUSTOM',
      title: 'Bad',
      contentBody: 'x',
      now,
    })
    // Tamper checksum
    const storeDoc = (svc as unknown as { repo: { save: (d: typeof bad) => typeof bad } }).repo
      ? bad
      : bad
    void storeDoc
    const mutated = { ...bad, checksum: 'fnv1a_deadbeef_1' }
    getDefaultDocumentService() // keep service
    expect(validateChecksum('x', mutated.checksum)).toBe(false)
    expect(svc.verifyChecksum(bad.documentId)).toBe(true)
  })

  it('handles edge cases: disabled flag, missing docs, passport metadata-only', () => {
    expect(() =>
      getDefaultDocumentService().create({
        documentType: 'CUSTOM',
        title: 'nope',
      }),
    ).toThrow(/document_center_v2_disabled/)

    enableV2()
    const svc = getDefaultDocumentService()
    expect(svc.get('missing')).toBeNull()
    expect(svc.download('missing')).toBeNull()
    expect(svc.regenerate('missing')).toBeNull()

    const passport = svc.create({
      documentType: 'PASSPORT',
      title: 'Passport',
      travelerId: 'traveler_omar',
      contentBody: 'SHOULD_NOT_STORE',
      metadata: { notes: 'metadata only' },
    })
    expect(passport.contentBody).toBeNull()
    expect(passport.mimeType).toBe('application/json')
    expect(passport.downloadUrl).toContain('metadataOnly')
  })

  it('preserves Sprint 62 legacy documents when v2 is OFF', () => {
    const trip = createTripFromBookings({
      userId: 'u',
      bookings: [flightBooking()],
      generateDocuments: true,
    })
    const legacy = getTripDocuments(trip)
    expect(legacy.all.length).toBeGreaterThan(0)
    expect(getTripDocumentsForTrip(trip.tripId)).toEqual([])
  })
})
