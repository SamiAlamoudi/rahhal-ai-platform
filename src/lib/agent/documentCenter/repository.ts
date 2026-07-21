/**
 * Sprint 63 — Document Repository (persistence facade over DocumentStore).
 */

import type { DocumentStore } from './store'
import type { EnterpriseDocument } from './types'

export class DocumentRepository {
  private readonly store: DocumentStore

  constructor(store: DocumentStore) {
    this.store = store
  }

  save(doc: EnterpriseDocument): EnterpriseDocument {
    const clone = structuredClone(doc)
    this.store.documents.set(clone.documentId, clone)
    return structuredClone(clone)
  }

  get(documentId: string): EnterpriseDocument | null {
    const d = this.store.documents.get(documentId)
    return d ? structuredClone(d) : null
  }

  list(): EnterpriseDocument[] {
    return [...this.store.documents.values()].map((d) => structuredClone(d))
  }

  listByTrip(tripId: string): EnterpriseDocument[] {
    return this.list().filter((d) => d.tripId === tripId && d.status !== 'deleted')
  }

  listByLineage(lineageId: string): EnterpriseDocument[] {
    return this.list()
      .filter((d) => d.lineageId === lineageId)
      .sort((a, b) => a.version - b.version)
  }

  delete(documentId: string, now: () => number = Date.now): EnterpriseDocument | null {
    const existing = this.get(documentId)
    if (!existing) return null
    const next: EnterpriseDocument = {
      ...existing,
      status: 'deleted',
      updatedAt: new Date(now()).toISOString(),
    }
    return this.save(next)
  }
}
