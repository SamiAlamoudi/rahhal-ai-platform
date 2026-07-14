export interface ProviderCapabilities {
  supportsRealtime: boolean
  supportsBooking: boolean
  supportsCancellation: boolean
  supportsPriceTracking: boolean
  supportsMultiCity: boolean
  supportsCalendarSearch: boolean
  /** Maximum offers a provider may return for one search. */
  offersMaxResults: number
  supportsRealTimePricing: boolean
  supportsFreeCancellation: boolean
  supportsFamilyFriendly: boolean
  supportsFlexibleDates: boolean
}

export function defaultCapabilities(): ProviderCapabilities {
  return {
    supportsRealtime: false,
    supportsBooking: false,
    supportsCancellation: false,
    supportsPriceTracking: false,
    supportsMultiCity: false,
    supportsCalendarSearch: false,
    offersMaxResults: 50,
    supportsRealTimePricing: true,
    supportsFreeCancellation: true,
    supportsFamilyFriendly: true,
    supportsFlexibleDates: true,
  }
}
