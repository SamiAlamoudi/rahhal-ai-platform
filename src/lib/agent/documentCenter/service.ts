/**
 * Sprint 63 — Enterprise Document Service.
 */

import { recordAudit, listAudit, listDownloadHistory, resetDocumentAuditSeq } from './audit'
import { computeChecksum, validateChecksum } from './checksum'
import { isDocumentCenterV2Enabled } from './feature'
import { defaultMimeType, findDuplicate, isExpired } from './metadata'
import { clearOfflineCache, getOfflineCacheMeta, listOfflineCache, markOfflineCached } from './offline'
import { draftsFromBookingExecution, draftsFromBookings } from './publish'
import { generateDownloadUrl, generatePreviewUrl } from './preview'
import { DocumentRepository } from './repository'
import { filterActive, filterExpired, searchDocuments, sortDocuments } from './search'
import { createShareLink, resolveShareLink, revokeShareLink } from './sharing'
import {
  getDefaultDocumentStore,
  resetDefaultDocumentStore,
  type DocumentStore,
} from './store'
import {
  appendDocumentTimeline,
  getDocumentTimeline,
  resetDocumentTimelineSeq,
} from './timeline'
import { validateDocuments } from './validation'
import { buildZipPackage } from './zip'
import type { UnifiedBooking } from '../bookingExecution/types'
import type { LiveProviderSdk } from '../liveProviders/types'
import type {
  CreateDocumentInput,
  DocumentSearchQuery,
  DocumentSortMode,
  DocumentValidationReport,
  EnterpriseDocument,
  ZipPackageResult,
} from './types'

function newId(prefix: string, now: () => number): string {
  return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export class DocumentService {
  private readonly store: DocumentStore
  private readonly repo: DocumentRepository

  constructor(store: DocumentStore = getDefaultDocumentStore()) {
    this.store = store
    this.repo = new DocumentRepository(store)
  }

  create(input: CreateDocumentInput): EnterpriseDocument {
    if (!isDocumentCenterV2Enabled()) {
      throw new Error('document_center_v2_disabled')
    }
    const now = input.now ?? (() => Date.now())
    const at = new Date(now()).toISOString()
    const mimeType = input.mimeType ?? defaultMimeType(input.documentType)
    const isPassport = input.documentType === 'PASSPORT'
    const contentBody = isPassport ? null : (input.contentBody ?? input.title)
    const checksumSource = isPassport
      ? JSON.stringify({
          type: 'PASSPORT',
          travelerId: input.travelerId,
          providerReference: input.providerReference,
          meta: input.metadata ?? {},
        })
      : (contentBody ?? '')
    const checksum = computeChecksum(checksumSource)

    // Versioning: regenerate → new immutable version
    let lineageId = input.lineageId ?? newId('lin', now)
    let version = 1
    if (input.versionOf) {
      const prev = this.repo.get(input.versionOf)
      if (prev) {
        lineageId = prev.lineageId
        version = prev.version + 1
        this.repo.save({
          ...prev,
          status: 'superseded',
          updatedAt: at,
        })
        appendDocumentTimeline(this.store, prev.documentId, 'superseded', {
          nextVersionPending: true,
        }, now)
      }
    }

    const duplicate = findDuplicate(this.repo.list(), {
      documentType: input.documentType,
      tripId: input.tripId,
      bookingId: input.bookingId,
      providerId: input.providerId,
      travelerId: input.travelerId,
      providerReference: input.providerReference,
      checksum,
    })
    if (duplicate && !input.versionOf) {
      recordAudit(this.store, {
        documentId: duplicate.documentId,
        action: 'generation',
        actorId: input.actorId,
        detail: { duplicate: true, skipped: true },
        now,
      })
      return duplicate
    }

    const documentId = newId('edoc', now)
    const downloadUrl =
      input.downloadUrl
      ?? generateDownloadUrl({
        title: input.title,
        documentType: input.documentType,
        documentId,
        contentBody,
        mimeType,
      })
    const previewUrl =
      input.previewUrl
      ?? generatePreviewUrl({
        documentType: input.documentType,
        title: input.title,
        contentBody,
        mimeType,
        documentId,
      })

    const fileSize = new TextEncoder().encode(contentBody ?? checksumSource).length

    let status = input.status ?? 'active'
    if (input.expiresAt && Date.parse(input.expiresAt) < now()) {
      status = 'expired'
    }

    const doc: EnterpriseDocument = {
      documentId,
      tripId: input.tripId ?? null,
      bookingId: input.bookingId ?? null,
      providerId: input.providerId ?? null,
      travelerId: input.travelerId ?? null,
      documentType: input.documentType,
      title: input.title,
      mimeType,
      fileSize,
      createdAt: at,
      updatedAt: at,
      expiresAt: input.expiresAt ?? null,
      status,
      providerReference: input.providerReference ?? null,
      downloadUrl,
      previewUrl,
      checksum,
      version,
      lineageId,
      metadata: {
        source: 'system',
        offlineCacheable: true,
        ...input.metadata,
        duplicateOf: duplicate?.documentId ?? null,
      },
      contentBody,
    }

    const saved = this.repo.save(doc)
    appendDocumentTimeline(this.store, saved.documentId, 'created', {
      version: saved.version,
      type: saved.documentType,
    }, now)
    recordAudit(this.store, {
      documentId: saved.documentId,
      action: input.versionOf ? 'version' : 'generation',
      actorId: input.actorId,
      detail: { version: saved.version, lineageId: saved.lineageId },
      now,
    })
    return saved
  }

  /** Create a new immutable version of an existing document. */
  regenerate(
    documentId: string,
    updates?: Partial<CreateDocumentInput>,
    now?: () => number,
  ): EnterpriseDocument | null {
    const prev = this.repo.get(documentId)
    if (!prev) return null
    return this.create({
      tripId: prev.tripId,
      bookingId: prev.bookingId,
      providerId: prev.providerId,
      travelerId: prev.travelerId,
      documentType: prev.documentType,
      title: updates?.title ?? prev.title,
      mimeType: updates?.mimeType ?? prev.mimeType,
      contentBody: updates?.contentBody ?? prev.contentBody,
      expiresAt: updates?.expiresAt !== undefined ? updates.expiresAt : prev.expiresAt,
      providerReference: updates?.providerReference ?? prev.providerReference,
      metadata: { ...prev.metadata, ...(updates?.metadata ?? {}), source: updates?.metadata?.source ?? prev.metadata.source },
      versionOf: prev.documentId,
      now: now ?? updates?.now,
      actorId: updates?.actorId,
    })
  }

  get(documentId: string): EnterpriseDocument | null {
    return this.repo.get(documentId)
  }

  listVersions(documentId: string): EnterpriseDocument[] {
    const doc = this.repo.get(documentId)
    if (!doc) return []
    return this.repo.listByLineage(doc.lineageId)
  }

  getByTrip(tripId: string): EnterpriseDocument[] {
    return this.repo.listByTrip(tripId)
  }

  search(query: DocumentSearchQuery, now?: () => number): EnterpriseDocument[] {
    return searchDocuments(this.repo.list(), query, now)
  }

  sort(docs: EnterpriseDocument[], mode: DocumentSortMode): EnterpriseDocument[] {
    return sortDocuments(docs, mode)
  }

  filterExpired(now?: () => number): EnterpriseDocument[] {
    return filterExpired(this.repo.list(), now)
  }

  filterActive(now?: () => number): EnterpriseDocument[] {
    return filterActive(this.repo.list(), now)
  }

  refreshExpiry(now?: () => number): EnterpriseDocument[] {
    const clock = now ?? (() => Date.now())
    const updated: EnterpriseDocument[] = []
    for (const doc of this.repo.list()) {
      if (doc.status === 'deleted' || doc.status === 'superseded') continue
      if (isExpired(doc, clock()) && doc.status !== 'expired') {
        const next = this.repo.save({
          ...doc,
          status: 'expired',
          updatedAt: new Date(clock()).toISOString(),
        })
        appendDocumentTimeline(this.store, next.documentId, 'expired', {}, clock)
        updated.push(next)
      }
    }
    return updated
  }

  download(documentId: string, actorId?: string | null, now?: () => number): string | null {
    const doc = this.repo.get(documentId)
    if (!doc || doc.status === 'deleted') return null
    recordAudit(this.store, {
      documentId,
      action: 'download',
      actorId,
      now,
    })
    return doc.downloadUrl
  }

  preview(documentId: string, actorId?: string | null, now?: () => number): string | null {
    const doc = this.repo.get(documentId)
    if (!doc || doc.status === 'deleted') return null
    recordAudit(this.store, {
      documentId,
      action: 'preview',
      actorId,
      now,
    })
    return doc.previewUrl
  }

  share(
    documentId: string,
    options?: { ttlMs?: number; actorId?: string | null; now?: () => number },
  ) {
    const doc = this.repo.get(documentId)
    if (!doc || doc.status === 'deleted') return null
    const link = createShareLink(this.store, {
      documentId,
      ttlMs: options?.ttlMs,
      now: options?.now,
    })
    recordAudit(this.store, {
      documentId,
      action: 'share',
      actorId: options?.actorId,
      detail: { shareId: link.shareId, expiresAt: link.expiresAt },
      now: options?.now,
    })
    return link
  }

  resolveShare(token: string, now?: () => number) {
    return resolveShareLink(this.store, token, now)
  }

  revokeShare(shareId: string): boolean {
    return revokeShareLink(this.store, shareId)
  }

  delete(documentId: string, actorId?: string | null, now?: () => number): EnterpriseDocument | null {
    const deleted = this.repo.delete(documentId, now)
    if (!deleted) return null
    appendDocumentTimeline(this.store, documentId, 'deleted', {}, now)
    recordAudit(this.store, {
      documentId,
      action: 'delete',
      actorId,
      now,
    })
    return deleted
  }

  uploadCustom(input: CreateDocumentInput): EnterpriseDocument {
    return this.create({
      ...input,
      documentType: input.documentType ?? 'CUSTOM',
      metadata: { ...input.metadata, source: 'upload' },
    })
  }

  publishFromBookings(input: {
    bookings: UnifiedBooking[]
    tripId?: string | null
    now?: () => number
  }): EnterpriseDocument[] {
    if (!isDocumentCenterV2Enabled()) return []
    const drafts = draftsFromBookings(input)
    return drafts.map((d) => this.create(d))
  }

  publishFromBookingExecution(input: {
    sessionId: string
    bookings: UnifiedBooking[]
    tripId?: string | null
    now?: () => number
  }): EnterpriseDocument[] {
    if (!isDocumentCenterV2Enabled()) return []
    const drafts = draftsFromBookingExecution(input)
    return drafts.map((d) => this.create(d))
  }

  /**
   * Refresh documents for a trip from provider retrieve (provider-agnostic).
   * Uses existing bookings on the trip path — callers pass UnifiedBooking snapshots.
   */
  async refreshFromProviders(input: {
    tripId: string
    bookings: UnifiedBooking[]
    sdks?: Record<string, LiveProviderSdk>
    now?: () => number
  }): Promise<EnterpriseDocument[]> {
    if (!isDocumentCenterV2Enabled()) return []
    const clock = input.now ?? (() => Date.now())
    // Soft refresh: re-publish from booking snapshots; optionally touch provider retrieve.
    if (input.sdks) {
      for (const b of input.bookings) {
        const sdk = input.sdks[b.provider]
        const orderId = b.providerBookingId ?? b.confirmation ?? b.hotelConfirmation
        if (sdk?.retrieveOrder && orderId) {
          try {
            await sdk.retrieveOrder(orderId)
          } catch {
            // ignore — still sync from local booking snapshot
          }
        }
      }
    }
    const published = this.publishFromBookings({
      bookings: input.bookings,
      tripId: input.tripId,
      now: clock,
    })
    for (const doc of published) {
      recordAudit(this.store, {
        documentId: doc.documentId,
        action: 'refresh',
        detail: { tripId: input.tripId },
        now: clock,
      })
    }
    return this.getByTrip(input.tripId)
  }

  syncTripDocuments(input: {
    tripId: string
    bookings: UnifiedBooking[]
    now?: () => number
  }): EnterpriseDocument[] {
    return this.publishFromBookings(input)
  }

  buildZip(tripId: string | null, documentIds?: string[], now?: () => number): ZipPackageResult {
    let docs = tripId ? this.getByTrip(tripId) : this.repo.list().filter((d) => d.status !== 'deleted')
    if (documentIds?.length) {
      docs = docs.filter((d) => documentIds.includes(d.documentId))
    }
    return buildZipPackage({ documents: docs, tripId, now })
  }

  validateTrip(input: {
    tripId: string
    hasFlights?: boolean
    hasHotels?: boolean
    now?: () => number
  }): DocumentValidationReport {
    return validateDocuments({
      documents: this.getByTrip(input.tripId),
      tripId: input.tripId,
      hasFlights: input.hasFlights,
      hasHotels: input.hasHotels,
      now: input.now,
    })
  }

  verifyChecksum(documentId: string): boolean {
    const doc = this.repo.get(documentId)
    if (!doc) return false
    if (doc.documentType === 'PASSPORT') return doc.checksum.length > 0
    return validateChecksum(doc.contentBody, doc.checksum)
  }

  timeline(documentId: string) {
    return getDocumentTimeline(this.store, documentId)
  }

  auditLog(documentId?: string) {
    return listAudit(this.store, documentId)
  }

  downloadHistory(documentId?: string) {
    return listDownloadHistory(this.store, documentId)
  }

  cacheOffline(documentId: string, now?: () => number) {
    const doc = this.repo.get(documentId)
    if (!doc) return null
    return markOfflineCached(this.store, doc, now)
  }

  getOfflineMeta(documentId: string) {
    return getOfflineCacheMeta(this.store, documentId)
  }

  listOffline() {
    return listOfflineCache(this.store)
  }

  clearOffline(documentId?: string) {
    clearOfflineCache(this.store, documentId)
  }
}

let defaultService: DocumentService | null = null

export function getDefaultDocumentService(): DocumentService {
  if (!defaultService) defaultService = new DocumentService()
  return defaultService
}

export function resetDefaultDocumentService(): void {
  resetDefaultDocumentStore()
  resetDocumentTimelineSeq()
  resetDocumentAuditSeq()
  defaultService = null
}

/** Hook used by Booking Execution when v2 flag is ON — no-op when OFF. */
export function publishDocumentsAfterBookingExecution(input: {
  sessionId: string
  bookings: UnifiedBooking[]
  tripId?: string | null
  now?: () => number
}): EnterpriseDocument[] {
  if (!isDocumentCenterV2Enabled()) return []
  return getDefaultDocumentService().publishFromBookingExecution(input)
}
