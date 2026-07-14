export interface BookingCapabilities {
  supportsRedirect: boolean
  supportsEmbeddedCheckout: boolean
  supportsMerchantBooking: boolean
  supportsCancellation: boolean
  supportsConfirmationImport: boolean
  supportsDeepLink: boolean
  bookingUrlAvailable: boolean
}

export function defaultBookingCapabilities(): BookingCapabilities {
  return {
    supportsRedirect: false,
    supportsEmbeddedCheckout: false,
    supportsMerchantBooking: false,
    supportsCancellation: false,
    supportsConfirmationImport: false,
    supportsDeepLink: false,
    bookingUrlAvailable: false,
  }
}

export function redirectOnlyCapabilities(): BookingCapabilities {
  return {
    ...defaultBookingCapabilities(),
    supportsRedirect: true,
    supportsDeepLink: true,
  }
}

export function redirectWithCancellationCapabilities(): BookingCapabilities {
  return {
    ...redirectOnlyCapabilities(),
    supportsCancellation: true,
  }
}

export function redirectWithCancellationAndImportCapabilities(): BookingCapabilities {
  return {
    ...redirectWithCancellationCapabilities(),
    supportsConfirmationImport: true,
  }
}
