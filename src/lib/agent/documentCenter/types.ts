/**
 * Sprint 63 — Enterprise Document Center contracts.
 * Single source of truth for travel documents (flag: ai.document_center_v2).
 * Does not replace Sprint 58 payments DocumentCenter when flag is OFF.
 */

export type EnterpriseDocumentType =
  | 'E_TICKET'
  | 'BOARDING_PASS'
  | 'HOTEL_VOUCHER'
  | 'HOTEL_CONFIRMATION'
  | 'INVOICE'
  | 'RECEIPT'
  | 'INSURANCE'
  | 'VISA'
  | 'PASSPORT'
  | 'ITINERARY'
  | 'CUSTOM'

export type EnterpriseDocumentStatus =
  | 'pending'
  | 'active'
  | 'expired'
  | 'superseded'
  | 'deleted'

export type DocumentAuditAction =
  | 'download'
  | 'preview'
  | 'share'
  | 'delete'
  | 'refresh'
  | 'generation'
  | 'upload'
  | 'version'

export type DocumentSortMode =
  | 'newest'
  | 'oldest'
  | 'type'
  | 'traveler'
  | 'provider'
  | 'expiry'

export interface EnterpriseDocument {
  documentId: string
  tripId: string | null
  bookingId: string | null
  providerId: string | null
  travelerId: string | null
  documentType: EnterpriseDocumentType
  title: string
  mimeType: string
  fileSize: number
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  status: EnterpriseDocumentStatus
  providerReference: string | null
  downloadUrl: string
  previewUrl: string | null
  checksum: string
  version: number
  /** Immutable content fingerprint group — same logical doc across versions. */
  lineageId: string
  metadata: DocumentMetadata
  /** Passport / sensitive: metadata only — no raw PII body. */
  contentBody: string | null
}

export interface DocumentMetadata {
  labels?: string[]
  locale?: string | null
  source?: 'booking_execution' | 'provider' | 'upload' | 'system' | 'sync'
  offlineCacheable?: boolean
  duplicateOf?: string | null
  notes?: string | null
  custom?: Record<string, unknown>
}

export interface DocumentTimelineEvent {
  id: string
  documentId: string
  timestamp: string
  type: string
  details: Record<string, unknown>
}

export interface DocumentAuditEntry {
  id: string
  documentId: string | null
  action: DocumentAuditAction
  at: string
  actorId: string | null
  detail?: Record<string, unknown>
}

export interface DocumentShareLink {
  shareId: string
  documentId: string
  token: string
  url: string
  createdAt: string
  expiresAt: string
  revoked: boolean
}

export interface DownloadHistoryEntry {
  id: string
  documentId: string
  at: string
  actorId: string | null
}

export interface OfflineCacheMeta {
  documentId: string
  cachedAt: string
  checksum: string
  mimeType: string
  fileSize: number
  expiresAt: string | null
}

export interface DocumentSearchQuery {
  travelerId?: string
  bookingId?: string
  tripId?: string
  providerId?: string
  documentType?: EnterpriseDocumentType
  /** ISO date YYYY-MM-DD matched against createdAt */
  date?: string
  expired?: boolean
  active?: boolean
  text?: string
}

export interface DocumentValidationReport {
  missing: Array<{ tripId: string; expectedType: EnterpriseDocumentType; reason: string }>
  expired: EnterpriseDocument[]
  duplicates: Array<{ documentId: string; duplicateOf: string }>
  invalidChecksum: EnterpriseDocument[]
}

export interface CreateDocumentInput {
  tripId?: string | null
  bookingId?: string | null
  providerId?: string | null
  travelerId?: string | null
  documentType: EnterpriseDocumentType
  title: string
  mimeType?: string
  contentBody?: string | null
  expiresAt?: string | null
  status?: EnterpriseDocumentStatus
  providerReference?: string | null
  downloadUrl?: string | null
  previewUrl?: string | null
  metadata?: DocumentMetadata
  lineageId?: string
  /** Force new version of existing lineage */
  versionOf?: string
  now?: () => number
  actorId?: string | null
}

export interface ZipPackageResult {
  packageId: string
  tripId: string | null
  filename: string
  mimeType: string
  fileSize: number
  checksum: string
  downloadUrl: string
  entryCount: number
  entries: Array<{ documentId: string; path: string; checksum: string }>
  createdAt: string
}

export const ENTERPRISE_DOCUMENT_TYPES: readonly EnterpriseDocumentType[] = [
  'E_TICKET',
  'BOARDING_PASS',
  'HOTEL_VOUCHER',
  'HOTEL_CONFIRMATION',
  'INVOICE',
  'RECEIPT',
  'INSURANCE',
  'VISA',
  'PASSPORT',
  'ITINERARY',
  'CUSTOM',
] as const
