import { supabase } from '../supabaseClient'
import type { PreferenceRow } from '../types'

export interface UpdatePreferencesInput {
  preferred_currency?: string
  preferred_language?: string
  theme?: string
  notification_enabled?: boolean
}

export const preferenceRepository = {
  async getForUser(): Promise<PreferenceRow | null> {
    const { data, error } = await supabase
      .from('preferences')
      .select('*')
      .maybeSingle()
    if (error) throw error
    return data
  },

  async upsert(input: UpdatePreferencesInput): Promise<PreferenceRow | null> {
    const { data, error } = await supabase
      .from('preferences')
      .upsert(input, { onConflict: 'user_id' })
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async delete(): Promise<boolean> {
    const { error } = await supabase.from('preferences').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
    return true
  },
}
