import { supabase } from '../supabaseClient'
import type { BookingSessionRow } from '../types'

export type { BookingSessionRow }

export interface CreateBookingSessionRowInput {
  travel_session_id: string | null
  status: string
  items: Record<string, unknown>
  subtotal: number
  fees: number
  total: number
  currency: string
  selected_booking_mode: string
  provider_references: Record<string, unknown>
  expires_at: string
}

export interface UpdateBookingSessionRowInput {
  status?: string
  items?: Record<string, unknown>
  subtotal?: number
  fees?: number
  total?: number
  currency?: string
  selected_booking_mode?: string
  provider_references?: Record<string, unknown>
  redirected_at?: string | null
  confirmed_at?: string | null
}

export const bookingSessionRepository = {
  async create(input: CreateBookingSessionRowInput): Promise<BookingSessionRow | null> {
    const { data, error } = await supabase
      .from('booking_sessions')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(id: string, updates: UpdateBookingSessionRowInput): Promise<BookingSessionRow | null> {
    const { data, error } = await supabase
      .from('booking_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<BookingSessionRow | null> {
    const { data, error } = await supabase
      .from('booking_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 50): Promise<BookingSessionRow[]> {
    const { data, error } = await supabase
      .from('booking_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('booking_sessions')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },
}
