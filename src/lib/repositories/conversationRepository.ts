import { supabase } from '../supabaseClient'
import type { ConversationRow } from '../types'

export interface CreateConversationInput {
  title?: string
  modality_default?: string
  travel_session_id?: string | null
  last_message_preview?: string
}

export interface UpdateConversationInput {
  title?: string
  modality_default?: string
  travel_session_id?: string | null
  last_message_preview?: string
}

export const conversationRepository = {
  async create(input: CreateConversationInput = {}): Promise<ConversationRow | null> {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        title: input.title?.trim() || 'محادثة جديدة',
        modality_default: input.modality_default ?? 'text',
        travel_session_id: input.travel_session_id ?? null,
        last_message_preview: input.last_message_preview ?? '',
      })
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(id: string, updates: UpdateConversationInput): Promise<ConversationRow | null> {
    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<ConversationRow | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 50): Promise<ConversationRow[]> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async touch(id: string, preview?: string): Promise<void> {
    const { error } = await supabase
      .from('conversations')
      .update({
        updated_at: new Date().toISOString(),
        ...(typeof preview === 'string' ? { last_message_preview: preview } : {}),
      })
      .eq('id', id)
    if (error) throw error
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('conversations').delete().eq('id', id)
    if (error) throw error
    return true
  },
}
