import { supabase } from '../supabaseClient'
import type { SearchHistoryRow } from '../types'

export interface CreateSearchHistoryInput {
  session_id: string | null
  destination: string
  search_request: Record<string, unknown>
  result_count: number
  ranked_top_option: string | null
}

export const searchHistoryRepository = {
  async create(input: CreateSearchHistoryInput): Promise<SearchHistoryRow | null> {
    const { data, error } = await supabase
      .from('search_history')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 50): Promise<SearchHistoryRow[]> {
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase.from('search_history').delete().eq('id', id)
    if (error) throw error
    return true
  },

  async countByUser(): Promise<number> {
    const { count, error } = await supabase
      .from('search_history')
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    return count ?? 0
  },
}
