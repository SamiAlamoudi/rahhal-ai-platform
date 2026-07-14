export type BookingMode = 'redirect' | 'embedded' | 'merchant'

export type BookingStatus =
  | 'draft'
  | 'selected'
  | 'ready_to_redirect'
  | 'redirected'
  | 'pending_provider_confirmation'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'expired'

export type BookingItemType =
  | 'flight'
  | 'hotel'
  | 'rental_car'
  | 'activity'
  | 'transfer'
  | 'insurance'
  | 'esim'

export interface BookingItem {
  id: string
  type: BookingItemType
  providerId: string
  providerName: string
  providerOfferId: string
  title: string
  price: number
  currency: string
  bookingUrl: string
  bookingMode: BookingMode
  expiresAt: string | null
  travelerSummary: string
  selectedAt: string
  metadata: Record<string, unknown>
}

export interface ProviderReference {
  providerId: string
  providerName: string
  providerBookingReference: string | null
  redirectUrl: string | null
}

export interface BookingSession {
  id: string
  userId: string
  travelSessionId: string | null
  status: BookingStatus
  items: BookingItem[]
  subtotal: number
  fees: number
  total: number
  currency: string
  selectedBookingMode: BookingMode
  providerReferences: ProviderReference[]
  createdAt: string
  updatedAt: string
  expiresAt: string
  redirectedAt: string | null
  confirmedAt: string | null
}

export const BOOKING_STATUS_VALUES: readonly BookingStatus[] = [
  'draft',
  'selected',
  'ready_to_redirect',
  'redirected',
  'pending_provider_confirmation',
  'confirmed',
  'failed',
  'cancelled',
  'expired',
] as const

export const BOOKING_MODE_VALUES: readonly BookingMode[] = [
  'redirect',
  'embedded',
  'merchant',
] as const

export const BOOKING_ITEM_TYPE_VALUES: readonly BookingItemType[] = [
  'flight',
  'hotel',
  'rental_car',
  'activity',
  'transfer',
  'insurance',
  'esim',
] as const

export const RAHHAL_BOOKING_FEE: number = 0
