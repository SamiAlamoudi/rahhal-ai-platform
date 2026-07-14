import { supabase } from '../supabaseClient'
import type { BookingItemRow } from '../types'

export type { BookingItemRow }

export interface CreateBookingItemRowInput {
  id?: string
  booking_session_id: string
  type: string
  provider_id: string
  provider_name: string
  provider_offer_id: string
  title: string
  price: number
  currency: string
  booking_url: string
  booking_mode: string
  expires_at: string | null
  traveler_summary: string
  selected_at: string
  metadata: Record<string, unknown>
}

export const bookingItemRepository = {
  async create(input: CreateBookingItemRowInput): Promise<BookingItemRow | null> {
    const { data, error } = await supabase
      .from('booking_items')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listBySession(sessionId: string): Promise<BookingItemRow[]> {
    const { data, error } = await supabase
      .from('booking_items')
      .select('*')
      .eq('booking_session_id', sessionId)
      .order('selected_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('booking_items')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  async deleteBySession(sessionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('booking_items')
      .delete()
      .eq('booking_session_id', sessionId)
    if (error) throw error
    return true
  },
}
