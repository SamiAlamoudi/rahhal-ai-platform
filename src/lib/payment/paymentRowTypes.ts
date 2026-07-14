export interface OrderRow {
  id: string
  user_id: string
  travel_session_id: string | null
  order_number: string
  booking_number: string
  customer_reference: string
  status: string
  cart: Record<string, unknown>
  travelers: Record<string, unknown>
  coupon_code: string | null
  discount_amount: number
  payment_session_id: string | null
  payment_provider: string | null
  paid_at: string | null
  confirmed_at: string | null
  invoice_number: string | null
  itinerary_id: string | null
  created_at: string
  updated_at: string
}

export interface PaymentSessionRow {
  id: string
  user_id: string
  order_id: string
  order_number: string
  provider_id: string
  status: string
  amount: number
  currency: string
  payment_method: string | null
  provider_reference: string | null
  authorization_code: string | null
  transaction_id: string | null
  description: string
  customer_email: string | null
  customer_name: string | null
  metadata: Record<string, unknown>
  paid_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export interface PaymentEventRow {
  id: string
  payment_session_id: string
  user_id: string
  event_type: string
  from_status: string | null
  to_status: string
  details: Record<string, unknown>
  created_at: string
}

export interface BookingLockRow {
  id: string
  user_id: string
  order_id: string
  lock_token: string
  status: string
  expires_at: string
  released_at: string | null
  created_at: string
}

export interface CouponRow {
  id: string
  code: string
  type: string
  value: number
  currency: string | null
  min_order_amount: number | null
  max_discount: number | null
  expires_at: string | null
  active: boolean
  description: string
  created_at: string
  updated_at: string
}
