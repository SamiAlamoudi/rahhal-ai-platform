import type { RahhalOrder } from './checkoutTypes'

export interface ItinerarySegment {
  type: string
  title: string
  providerName: string
  details: string
  bookingReference: string | null
}

export interface Itinerary {
  id: string
  orderNumber: string
  bookingNumber: string
  customerReference: string
  segments: ItinerarySegment[]
  travelers: { name: string; type: string }[]
  totalAmount: number
  currency: string
  generatedAt: string
}

export function generateItinerary(order: RahhalOrder): Itinerary {
  const segments: ItinerarySegment[] = order.cart.items.map(item => ({
    type: item.type,
    title: item.title,
    providerName: item.providerName,
    details: item.travelerSummary || '',
    bookingReference: null,
  }))

  const travelers = order.travelers.map(t => ({
    name: `${t.firstName} ${t.lastName}`.trim(),
    type: t.type,
  }))

  return {
    id: order.itineraryId ?? `ITIN-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    bookingNumber: order.bookingNumber,
    customerReference: order.customerReference,
    segments,
    travelers,
    totalAmount: order.cart.total,
    currency: order.cart.currency,
    generatedAt: new Date().toISOString(),
  }
}
