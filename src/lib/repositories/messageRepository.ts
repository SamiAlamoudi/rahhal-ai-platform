import { supabase } from '../supabaseClient'
import type { MessageRow } from '../types'

export interface CreateMessageInput {
  conversation_id: string
  role: string
  content?: string
  modality?: string
  audio_url?: string | null
  image_url?: string | null
  attachments?: unknown[]
  status?: string
  error?: string | null
  provider_meta?: Record<string, unknown>
}

export interface UpdateMessageInput {
  content?: string
  status?: string
  error?: string | null
  audio_url?: string | null
  image_url?: string | null
  attachments?: unknown[]
  provider_meta?: Record<string, unknown>
}

export const messageRepository = {
  async create(input: CreateMessageInput): Promise<MessageRow | null> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: input.conversation_id,
        role: input.role,
        content: input.content ?? '',
        modality: input.modality ?? 'text',
        audio_url: input.audio_url ?? null,
        image_url: input.image_url ?? null,
        attachments: input.attachments ?? [],
        status: input.status ?? 'complete',
        error: input.error ?? null,
        provider_meta: input.provider_meta ?? {},
      })
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(id: string, updates: UpdateMessageInput): Promise<MessageRow | null> {
    const { data, error } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByConversation(conversationId: string, limit: number = 500): Promise<MessageRow[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async getById(id: string): Promise<MessageRow | null> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) throw error
    return true
  },

  async deleteByConversation(conversationId: string): Promise<boolean> {
    const { error } = await supabase.from('messages').delete().eq('conversation_id', conversationId)
    if (error) throw error
    return true
  },
}
