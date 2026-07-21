/**
 * Sprint 63 — offline cache metadata (no binary blob store).
 */

import type { DocumentStore } from './store'
import type { EnterpriseDocument, OfflineCacheMeta } from './types'

export function markOfflineCached(
  store: DocumentStore,
  doc: EnterpriseDocument,
  now: () => number = Date.now,
): OfflineCacheMeta {
  const meta: OfflineCacheMeta = {
    documentId: doc.documentId,
    cachedAt: new Date(now()).toISOString(),
    checksum: doc.checksum,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    expiresAt: doc.expiresAt,
  }
  store.offline.set(doc.documentId, meta)
  return { ...meta }
}

export function getOfflineCacheMeta(
  store: DocumentStore,
  documentId: string,
): OfflineCacheMeta | null {
  const m = store.offline.get(documentId)
  return m ? { ...m } : null
}

export function listOfflineCache(store: DocumentStore): OfflineCacheMeta[] {
  return [...store.offline.values()].map((m) => ({ ...m }))
}

export function clearOfflineCache(store: DocumentStore, documentId?: string): void {
  if (documentId) store.offline.delete(documentId)
  else store.offline.clear()
}
