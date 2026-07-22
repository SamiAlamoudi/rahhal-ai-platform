/**
 * Rahhal Alpha — local chat persistence fallback.
 * Used when Supabase auth/RLS is unavailable (demo or offline).
 * Does not replace production Supabase persistence.
 */

import { AppError, extractErrorText } from '../ops/errors/canonicalError'
import type { ChatConversation, ChatMessage, ChatModality } from './chatTypes'

const STORAGE_KEY = 'rahhal.alpha.chat.v1'

type LocalChatDb = {
  conversations: ChatConversation[]
  messages: Record<string, ChatMessage[]>
}

const memoryFallback = new Map<string, string>()

function storage(): Storage | { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    /* ignore */
  }
  return {
    getItem: (k) => memoryFallback.get(k) ?? null,
    setItem: (k, v) => {
      memoryFallback.set(k, v)
    },
    removeItem: (k) => {
      memoryFallback.delete(k)
    },
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function emptyDb(): LocalChatDb {
  return { conversations: [], messages: {} }
}

function readDb(): LocalChatDb {
  try {
    const raw = storage().getItem(STORAGE_KEY)
    if (!raw) return emptyDb()
    const parsed = JSON.parse(raw) as LocalChatDb
    if (!parsed || !Array.isArray(parsed.conversations)) return emptyDb()
    return {
      conversations: parsed.conversations,
      messages: parsed.messages ?? {},
    }
  } catch {
    return emptyDb()
  }
}

function writeDb(db: LocalChatDb): void {
  storage().setItem(STORAGE_KEY, JSON.stringify(db))
}

export function clearLocalChatStore(): void {
  storage().removeItem(STORAGE_KEY)
  memoryFallback.delete(STORAGE_KEY)
}

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

/**
 * Detect auth/demo failures that should use local chat persistence.
 * Must NOT use `String(plainObject)` — Supabase/PostgREST errors are plain
 * objects and stringify to "[object Object]".
 */
export function isLocalChatAuthError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  if (code === 'auth_error' || code === '28000' || code === 'PGRST301') return true
  if (error instanceof AppError && error.code === 'auth_error') return true
  const message = extractErrorText(error, '')
  return /supabase session|demo|تسجيل الدخول|jwt|not authenticated|\bauth\b/i.test(message)
}

/**
 * Persistence failures where Alpha local chat is the correct recovery path.
 * Covers RLS, missing grants, and network/DNS failures to Supabase (common on
 * Preview / flaky mobile networks) — without masking validation errors.
 */
export function shouldUseLocalChatFallback(error: unknown): boolean {
  if (isLocalChatAuthError(error)) return true

  if (error instanceof AppError) {
    if (error.code === 'forbidden' || error.code === 'auth_error' || error.code === 'config_error') {
      return true
    }
    // diagnosePipelineError maps fetch/network → provider_unavailable; still recover locally.
    if (error.code === 'provider_unavailable') {
      const technical = extractErrorText(error.cause, error.message).toLowerCase()
      if (
        technical.includes('fetch')
        || technical.includes('network')
        || technical.includes('enotfound')
        || technical.includes('load failed')
        || technical.includes('econnrefused')
      ) {
        return true
      }
    }
  }

  const code = (error as { code?: string } | null)?.code ?? ''
  if (
    code === 'forbidden'
    || code === '42501'
    || code === 'PGRST301'
    || code === '42P01'
    || code === 'PGRST205'
  ) {
    return true
  }

  const message = extractErrorText(error, '').toLowerCase()
  if (!message || message === 'unknown_error' || message === '[object object]') return false

  return (
    message.includes('permission denied')
    || message.includes('row-level security')
    || message.includes('rls')
    || message.includes('fetch failed')
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('enotfound')
    || message.includes('econnrefused')
    || message.includes('econnreset')
    || message.includes('err_name_not_resolved')
  )
}

export const localChatStore = {
  listConversations(limit = 50): ChatConversation[] {
    const db = readDb()
    return [...db.conversations]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
  },

  createConversation(title?: string): ChatConversation {
    const db = readDb()
    const at = nowIso()
    const conversation: ChatConversation = {
      id: id('lconv'),
      title: title?.trim() || 'محادثة جديدة',
      modalityDefault: 'text',
      travelSessionId: null,
      lastMessagePreview: '',
      createdAt: at,
      updatedAt: at,
    }
    db.conversations.unshift(conversation)
    db.messages[conversation.id] = []
    writeDb(db)
    return conversation
  },

  renameConversation(conversationId: string, title: string): ChatConversation {
    const db = readDb()
    const row = db.conversations.find((c) => c.id === conversationId)
    if (!row) throw new Error('conversation_not_found')
    row.title = title.trim()
    row.updatedAt = nowIso()
    writeDb(db)
    return { ...row }
  },

  deleteConversation(conversationId: string): void {
    const db = readDb()
    db.conversations = db.conversations.filter((c) => c.id !== conversationId)
    delete db.messages[conversationId]
    writeDb(db)
  },

  getConversationDetail(conversationId: string): {
    conversation: ChatConversation
    messages: ChatMessage[]
  } {
    const db = readDb()
    const conversation = db.conversations.find((c) => c.id === conversationId)
    if (!conversation) throw new Error('conversation_not_found')
    return {
      conversation: { ...conversation },
      messages: [...(db.messages[conversationId] ?? [])],
    }
  },

  touchConversation(conversationId: string, preview?: string): void {
    const db = readDb()
    const row = db.conversations.find((c) => c.id === conversationId)
    if (!row) return
    row.updatedAt = nowIso()
    if (typeof preview === 'string') row.lastMessagePreview = preview
    writeDb(db)
  },

  appendMessage(input: {
    conversationId: string
    role: ChatMessage['role']
    content: string
    modality?: ChatModality
    status?: ChatMessage['status']
    providerMeta?: ChatMessage['providerMeta']
    error?: string | null
  }): ChatMessage {
    const db = readDb()
    const list = db.messages[input.conversationId] ?? []
    const at = nowIso()
    const message: ChatMessage = {
      id: id('lmsg'),
      conversationId: input.conversationId,
      role: input.role,
      modality: input.modality ?? 'text',
      content: input.content,
      audioUrl: null,
      imageUrl: null,
      attachments: [],
      status: input.status ?? 'complete',
      error: input.error ?? null,
      providerMeta: input.providerMeta ?? {},
      createdAt: at,
      updatedAt: at,
    }
    list.push(message)
    db.messages[input.conversationId] = list
    const conv = db.conversations.find((c) => c.id === input.conversationId)
    if (conv) {
      conv.updatedAt = at
      if (input.content) conv.lastMessagePreview = input.content.slice(0, 120)
    }
    writeDb(db)
    return message
  },

  updateMessage(
    conversationId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ): ChatMessage {
    const db = readDb()
    const list = db.messages[conversationId] ?? []
    const idx = list.findIndex((m) => m.id === messageId)
    if (idx < 0) throw new Error('message_not_found')
    const next = {
      ...list[idx]!,
      ...patch,
      updatedAt: nowIso(),
    }
    list[idx] = next
    db.messages[conversationId] = list
    const conv = db.conversations.find((c) => c.id === conversationId)
    if (conv && typeof patch.content === 'string' && patch.content) {
      conv.lastMessagePreview = patch.content.slice(0, 120)
      conv.updatedAt = nowIso()
    }
    writeDb(db)
    return next
  },
}
