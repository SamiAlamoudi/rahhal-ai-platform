export interface ProviderCapabilities {
  supportsRealtime: boolean
  supportsBooking: boolean
  supportsCancellation: boolean
  supportsPriceTracking: boolean
  supportsMultiCity: boolean
  supportsCalendarSearch: boolean
}

export function defaultCapabilities(): ProviderCapabilities {
  return {
    supportsRealtime: false,
    supportsBooking: false,
    supportsCancellation: false,
    supportsPriceTracking: false,
    supportsMultiCity: false,
    supportsCalendarSearch: false,
  }
}

