/**
 * Sprint 63 — in-memory document store.
 */

import type {
  DocumentAuditEntry,
  DocumentShareLink,
  DocumentTimelineEvent,
  DownloadHistoryEntry,
  EnterpriseDocument,
  OfflineCacheMeta,
} from './types'

export class DocumentStore {
  readonly documents = new Map<string, EnterpriseDocument>()
  readonly timeline = new Map<string, DocumentTimelineEvent[]>()
  readonly audit: DocumentAuditEntry[] = []
  readonly downloads: DownloadHistoryEntry[] = []
  readonly shares = new Map<string, DocumentShareLink>()
  readonly offline = new Map<string, OfflineCacheMeta>()

  clear(): void {
    this.documents.clear()
    this.timeline.clear()
    this.audit.length = 0
    this.downloads.length = 0
    this.shares.clear()
    this.offline.clear()
  }
}

let defaultStore: DocumentStore | null = null

export function getDefaultDocumentStore(): DocumentStore {
  if (!defaultStore) defaultStore = new DocumentStore()
  return defaultStore
}

export function resetDefaultDocumentStore(): void {
  defaultStore?.clear()
  defaultStore = null
}
