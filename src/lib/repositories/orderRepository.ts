import { supabase } from '../supabaseClient'
import type { OrderRow } from '../payment/paymentRowTypes'

export type { OrderRow } from '../payment/paymentRowTypes'

export interface CreateOrderRowInput {
  /** Optional client-generated UUID so domain + DB share the same id. */
  id?: string
  travel_session_id: string | null
  order_number: string
  booking_number: string
  customer_reference: string
  status: string
  cart: Record<string, unknown>
  travelers: Record<string, unknown>
  coupon_code: string | null
  discount_amount: number
}

export interface UpdateOrderRowInput {
  status?: string
  cart?: Record<string, unknown>
  travelers?: Record<string, unknown>
  coupon_code?: string | null
  discount_amount?: number
  payment_session_id?: string | null
  payment_provider?: string | null
  paid_at?: string | null
  confirmed_at?: string | null
  invoice_number?: string | null
  itinerary_id?: string | null
}

export const orderRepository = {
  async create(input: CreateOrderRowInput): Promise<OrderRow | null> {
    const { data, error } = await supabase
      .from('orders')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(id: string, updates: UpdateOrderRowInput): Promise<OrderRow | null> {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<OrderRow | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getByOrderNumber(orderNumber: string): Promise<OrderRow | null> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 50): Promise<OrderRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async listAll(limit: number = 100): Promise<OrderRow[]> {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },
}
