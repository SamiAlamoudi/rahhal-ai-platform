/**
 * Sprint 63 — secure temporary share links.
 */

import type { DocumentStore } from './store'
import type { DocumentShareLink } from './types'

function randomToken(): string {
  return `shr_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function createShareLink(
  store: DocumentStore,
  input: {
    documentId: string
    ttlMs?: number
    now?: () => number
  },
): DocumentShareLink {
  const now = input.now ?? (() => Date.now())
  const ttl = input.ttlMs ?? 24 * 60 * 60 * 1000
  const createdAt = new Date(now()).toISOString()
  const expiresAt = new Date(now() + ttl).toISOString()
  const token = randomToken()
  const share: DocumentShareLink = {
    shareId: `share_${now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    documentId: input.documentId,
    token,
    url: `https://rahhal.app/share/docs/${token}`,
    createdAt,
    expiresAt,
    revoked: false,
  }
  store.shares.set(share.shareId, share)
  return { ...share }
}

export function resolveShareLink(
  store: DocumentStore,
  token: string,
  now: () => number = Date.now,
): DocumentShareLink | null {
  for (const share of store.shares.values()) {
    if (share.token !== token) continue
    if (share.revoked) return null
    if (Date.parse(share.expiresAt) < now()) return null
    return { ...share }
  }
  return null
}

export function revokeShareLink(store: DocumentStore, shareId: string): boolean {
  const share = store.shares.get(shareId)
  if (!share) return false
  store.shares.set(shareId, { ...share, revoked: true })
  return true
}
