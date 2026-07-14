import { supabase } from '../supabaseClient'
import type { PaymentSessionRow, PaymentEventRow } from '../payment/paymentRowTypes'

export type { PaymentSessionRow, PaymentEventRow } from '../payment/paymentRowTypes'

export interface CreatePaymentSessionRowInput {
  id: string
  order_id: string
  order_number: string
  provider_id: string
  status: string
  amount: number
  currency: string
  description: string
  customer_email: string | null
  customer_name: string | null
  metadata: Record<string, unknown>
  expires_at: string
}

export interface UpdatePaymentSessionRowInput {
  status?: string
  payment_method?: string | null
  provider_reference?: string | null
  authorization_code?: string | null
  transaction_id?: string | null
  metadata?: Record<string, unknown>
  paid_at?: string | null
}

export interface CreatePaymentEventRowInput {
  payment_session_id: string
  event_type: string
  from_status: string | null
  to_status: string
  details: Record<string, unknown>
}

export const paymentSessionRepository = {
  async create(input: CreatePaymentSessionRowInput): Promise<PaymentSessionRow | null> {
    const { data, error } = await supabase
      .from('payment_sessions')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async update(id: string, updates: UpdatePaymentSessionRowInput): Promise<PaymentSessionRow | null> {
    const { data, error } = await supabase
      .from('payment_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<PaymentSessionRow | null> {
    const { data, error } = await supabase
      .from('payment_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listByUser(limit: number = 50): Promise<PaymentSessionRow[]> {
    const { data, error } = await supabase
      .from('payment_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async listByOrderId(orderId: string): Promise<PaymentSessionRow[]> {
    const { data, error } = await supabase
      .from('payment_sessions')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('payment_sessions')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },
}

export const paymentEventRepository = {
  async create(input: CreatePaymentEventRowInput): Promise<PaymentEventRow | null> {
    const { data, error } = await supabase
      .from('payment_events')
      .insert(input)
      .select()
      .maybeSingle()
    if (error) throw error
    return data
  },

  async listBySession(paymentSessionId: string): Promise<PaymentEventRow[]> {
    const { data, error } = await supabase
      .from('payment_events')
      .select('*')
      .eq('payment_session_id', paymentSessionId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async listByUser(limit: number = 100): Promise<PaymentEventRow[]> {
    const { data, error } = await supabase
      .from('payment_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },
}
