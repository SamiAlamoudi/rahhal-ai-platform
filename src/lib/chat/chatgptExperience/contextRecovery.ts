/**
 * Sprint 44 — browser context recovery (refresh-safe).
 * Restores conversation, draft, modality, voice mode — no server schema changes.
 */

import type { SessionUiRecovery } from './types'

const KEY = 'rahhal.chat.uiRecovery.v1'

export function readSessionUiRecovery(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !== 'undefined' ? localStorage : null,
): SessionUiRecovery | null {
  try {
    const raw = storage?.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SessionUiRecovery
    if (!parsed || typeof parsed !== 'object') return null
    return {
      conversationId: parsed.conversationId ?? null,
      draft: typeof parsed.draft === 'string' ? parsed.draft : '',
      modality: parsed.modality === 'voice' ? 'voice' : 'text',
      voiceMode: parsed.voiceMode === 'hands_free' ? 'hands_free' : 'push_to_talk',
      voiceLocale: parsed.voiceLocale === 'en' ? 'en' : 'ar',
      pinnedIds: Array.isArray(parsed.pinnedIds) ? parsed.pinnedIds.filter((x) => typeof x === 'string') : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function writeSessionUiRecovery(
  patch: Partial<SessionUiRecovery>,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null | undefined = typeof localStorage !== 'undefined' ? localStorage : null,
): SessionUiRecovery {
  const prev = readSessionUiRecovery(storage) ?? {
    conversationId: null,
    draft: '',
    modality: 'text' as const,
    voiceMode: 'push_to_talk' as const,
    voiceLocale: 'ar' as const,
    pinnedIds: [] as string[],
    updatedAt: new Date().toISOString(),
  }
  const next: SessionUiRecovery = {
    ...prev,
    ...patch,
    pinnedIds: patch.pinnedIds ?? prev.pinnedIds,
    updatedAt: new Date().toISOString(),
  }
  try {
    storage?.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore quota
  }
  return next
}

export function togglePinnedConversation(
  conversationId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): string[] {
  const prev = readSessionUiRecovery(storage)
  const pinned = new Set(prev?.pinnedIds ?? [])
  if (pinned.has(conversationId)) pinned.delete(conversationId)
  else pinned.add(conversationId)
  const ids = [...pinned]
  writeSessionUiRecovery({ pinnedIds: ids }, storage)
  return ids
}
