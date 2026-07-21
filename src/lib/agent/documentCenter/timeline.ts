/**
 * Sprint 63 — append-only document timeline.
 */

import type { DocumentStore } from './store'
import type { DocumentTimelineEvent } from './types'

let seq = 0

export function resetDocumentTimelineSeq(): void {
  seq = 0
}

export function appendDocumentTimeline(
  store: DocumentStore,
  documentId: string,
  type: string,
  details: Record<string, unknown> = {},
  now: () => number = Date.now,
): DocumentTimelineEvent {
  seq += 1
  const event: DocumentTimelineEvent = {
    id: `dtev_${now().toString(36)}_${seq.toString(36)}`,
    documentId,
    timestamp: new Date(now()).toISOString(),
    type,
    details,
  }
  const prev = store.timeline.get(documentId) ?? []
  store.timeline.set(documentId, [...prev, event])
  return event
}

export function getDocumentTimeline(
  store: DocumentStore,
  documentId: string,
): DocumentTimelineEvent[] {
  return [...(store.timeline.get(documentId) ?? [])]
}
