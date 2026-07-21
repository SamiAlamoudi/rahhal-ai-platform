/**
 * Sprint 63 — document access / audit log.
 */

import type { DocumentStore } from './store'
import type { DocumentAuditAction, DocumentAuditEntry, DownloadHistoryEntry } from './types'

let seq = 0

export function resetDocumentAuditSeq(): void {
  seq = 0
}

export function recordAudit(
  store: DocumentStore,
  input: {
    documentId: string | null
    action: DocumentAuditAction
    actorId?: string | null
    detail?: Record<string, unknown>
    now?: () => number
  },
): DocumentAuditEntry {
  const now = input.now ?? (() => Date.now())
  seq += 1
  const entry: DocumentAuditEntry = {
    id: `daud_${now().toString(36)}_${seq.toString(36)}`,
    documentId: input.documentId,
    action: input.action,
    at: new Date(now()).toISOString(),
    actorId: input.actorId ?? null,
    detail: input.detail,
  }
  store.audit.push(entry)
  if (input.action === 'download' && input.documentId) {
    const dl: DownloadHistoryEntry = {
      id: `ddl_${now().toString(36)}_${seq.toString(36)}`,
      documentId: input.documentId,
      at: entry.at,
      actorId: entry.actorId,
    }
    store.downloads.push(dl)
  }
  return entry
}

export function listAudit(store: DocumentStore, documentId?: string): DocumentAuditEntry[] {
  if (!documentId) return [...store.audit]
  return store.audit.filter((e) => e.documentId === documentId)
}

export function listDownloadHistory(
  store: DocumentStore,
  documentId?: string,
): DownloadHistoryEntry[] {
  if (!documentId) return [...store.downloads]
  return store.downloads.filter((d) => d.documentId === documentId)
}
