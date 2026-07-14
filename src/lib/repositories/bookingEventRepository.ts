import { supabase } from '../supabaseClient'
import type { BookingEventRow } from '../types'

export type { BookingEventRow }

export interface CreateBookingEventRowInput {
  booking_session_id: string
  event_type: string
  from_status: string | null
  to_status: string
  details: Record<string, unknown>
}

export const bookingEventRepository = {
  async create(input: CreateBookingEventRowInput): Promise<BookingEventRow | null> {
    const { data, error } = await supabase
      .from('booking_events')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listBySession(sessionId: string): Promise<BookingEventRow[]> {
    const { data, error } = await supabase
      .from('booking_events')
      .select('*')
      .eq('booking_session_id', sessionId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async listByUser(limit: number = 100): Promise<BookingEventRow[]> {
    const { data, error } = await supabase
      .from('booking_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },
}
