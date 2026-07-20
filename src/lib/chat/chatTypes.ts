import type { ChatMessageRole, ChatMessageStatus, ChatModality, ConversationRow, MessageRow } from '../types'
import { normalizeAttachments, type ChatAttachment } from './chatAttachments'

/**
 * Shared chat domain contracts for text today and voice later.
 * Voice will reuse the same Conversation/Message lifecycle with modality='audio'.
 */

export type { ChatMessageRole, ChatMessageStatus, ChatModality, ChatAttachment }

export interface ChatConversation {
  id: string
  title: string
  modalityDefault: ChatModality
  travelSessionId: string | null
  lastMessagePreview: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: ChatMessageRole
  modality: ChatModality
  content: string
  audioUrl: string | null
  imageUrl: string | null
  attachments: ChatAttachment[]
  status: ChatMessageStatus
  error: string | null
  providerMeta: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ChatStreamChunk {
  type: 'delta' | 'done' | 'error'
  text?: string
  error?: string
  /** Optional structured metadata attached on `done` (e.g. Travel AI Agent itinerary). */
  meta?: Record<string, unknown>
  /** Sprint 44 — progressive ChatGPT-like experience state (optional on deltas). */
  experienceState?: string
}

export interface ChatCompletionRequest {
  conversationId: string
  messages: ChatMessage[]
  signal: AbortSignal
}

export interface ChatProvider {
  readonly providerId: string
  streamReply(input: ChatCompletionRequest): AsyncIterable<ChatStreamChunk>
}

export function conversationFromRow(row: ConversationRow): ChatConversation {
  return {
    id: row.id,
    title: row.title,
    modalityDefault: row.modality_default === 'audio' ? 'audio' : 'text',
    travelSessionId: row.travel_session_id,
    lastMessagePreview: row.last_message_preview ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function messageFromRow(row: MessageRow): ChatMessage {
  const role = row.role === 'assistant' || row.role === 'system' ? row.role : 'user'
  const status: ChatMessageStatus =
    row.status === 'pending'
    || row.status === 'streaming'
    || row.status === 'error'
    || row.status === 'cancelled'
      ? row.status
      : 'complete'
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role,
    modality: row.modality === 'audio' ? 'audio' : 'text',
    content: row.content ?? '',
    audioUrl: row.audio_url,
    imageUrl: row.image_url ?? null,
    attachments: normalizeAttachments(row.attachments),
    status,
    error: row.error,
    providerMeta: row.provider_meta ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
