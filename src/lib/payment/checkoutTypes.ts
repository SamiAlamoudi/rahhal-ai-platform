export type OrderStatus =
  | 'draft'
  | 'created'
  | 'pending_payment'
  | 'paid'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'refunded'

export type CheckoutItemType =
  | 'flight'
  | 'hotel'
  | 'rental_car'
  | 'activity'
  | 'transfer'
  | 'insurance'
  | 'esim'

export interface CheckoutItem {
  id: string
  type: CheckoutItemType
  providerId: string
  providerName: string
  providerOfferId: string
  title: string
  price: number
  currency: string
  bookingUrl: string
  expiresAt: string | null
  travelerSummary: string
  metadata: Record<string, unknown>
}

export interface CheckoutCart {
  items: CheckoutItem[]
  subtotal: number
  taxes: number
  fees: number
  discount: number
  total: number
  currency: string
}

export interface TravelerInfo {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string | null
  passportNumber: string | null
  passportExpiry: string | null
  nationality: string | null
  type: 'adult' | 'child' | 'infant'
}

export interface CheckoutReviewData {
  travelers: TravelerInfo[]
  acceptedTerms: boolean
  baggageSummary: Record<string, string>
  hotelRoomSummary: string | null
  cancellationPolicies: string[]
  rentalConditions: string | null
}

export interface RahhalOrder {
  id: string
  orderNumber: string
  bookingNumber: string
  customerReference: string
  userId: string
  travelSessionId: string | null
  status: OrderStatus
  cart: CheckoutCart
  travelers: TravelerInfo[]
  couponCode: string | null
  discountAmount: number
  paymentSessionId: string | null
  paymentProvider: string | null
  paidAt: string | null
  confirmedAt: string | null
  invoiceNumber: string | null
  itineraryId: string | null
  createdAt: string
  updatedAt: string
}

export interface Coupon {
  code: string
  type: 'percentage' | 'fixed'
  value: number
  currency: string | null
  minOrderAmount: number | null
  maxDiscount: number | null
  expiresAt: string | null
  active: boolean
  description: string
}

export interface CouponValidationResult {
  valid: boolean
  coupon: Coupon | null
  discountAmount: number
  message: string
}

export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  'draft',
  'created',
  'pending_payment',
  'paid',
  'confirmed',
  'failed',
  'cancelled',
  'refunded',
] as const

export const TAX_RATE = 0.15
export const RAHHAL_SERVICE_FEE = 0
