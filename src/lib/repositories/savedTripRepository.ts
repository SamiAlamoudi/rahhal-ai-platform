import { supabase } from '../supabaseClient'
import type { SavedTripRow } from '../types'

export interface CreateSavedTripInput {
  session_id: string | null
  title: string
  destination: string
  trip_data: Record<string, unknown>
}

export const savedTripRepository = {
  async create(input: CreateSavedTripInput): Promise<SavedTripRow | null> {
    const { data, error } = await supabase
      .from('saved_trips')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<CreateSavedTripInput>): Promise<SavedTripRow | null> {
    const { data, error } = await supabase
      .from('saved_trips')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<SavedTripRow | null> {
    const { data, error } = await supabase
      .from('saved_trips')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 50): Promise<SavedTripRow[]> {
    const { data, error } = await supabase
      .from('saved_trips')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('saved_trips').delete().eq('id', id)
    if (error) throw error
    return true
  },
}
