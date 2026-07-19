/**
 * Sprint 35 — TripDocuments bundle generator.
 */

import { BoardingPassService } from './BoardingPassService'
import { HotelVoucherService } from './HotelVoucherService'
import { ItineraryGenerator } from './ItineraryGenerator'
import { TicketService } from './TicketService'
import type {
  BookingSummaryDoc,
  CreatePostBookingTripInput,
  InvoiceBundleDoc,
  PdfItineraryDoc,
  TripDocumentBundle,
} from './postBookingTypes'

export class TripDocuments {
  private readonly itineraries = new ItineraryGenerator()
  private readonly hotels = new HotelVoucherService()
  private readonly tickets = new TicketService()
  private readonly boarding = new BoardingPassService()

  generateBundle(input: CreatePostBookingTripInput, tripId: string): TripDocumentBundle {
    const itinerary = this.itineraries.generate(input, tripId)
    const hotelVoucher = this.hotels.generate(input, tripId)
    const eTicket = this.tickets.generate(input, tripId)
    const boardingPass = this.boarding.generate(tripId, eTicket)

    const bookingSummary: BookingSummaryDoc = {
      summaryId: `sum_${Math.random().toString(36).slice(2, 10)}`,
      tripId,
      bookingReference: input.references.bookingReference,
      total: input.totalPaid,
      currency: input.currency,
      travelers: Math.max(1, input.travelers ?? 1),
      flightConfirmation: input.references.flightConfirmation,
      hotelConfirmation: input.references.hotelConfirmation,
      hotelName: input.hotelName ?? null,
      generatedAt: new Date().toISOString(),
    }

    const pdfItinerary: PdfItineraryDoc = {
      documentId: `pdf_${Math.random().toString(36).slice(2, 10)}`,
      tripId,
      fileName: `${itinerary.title.replace(/\s+/g, '-').toLowerCase()}-itinerary.pdf`,
      pdfUri: `rahhal://documents/itinerary/${tripId}.pdf`,
      pages: Math.max(1, itinerary.days.length),
      generatedAt: new Date().toISOString(),
    }

    const invoiceBundle: InvoiceBundleDoc = {
      bundleId: `bundle_${Math.random().toString(36).slice(2, 10)}`,
      tripId,
      receiptId: input.paymentReceiptId ?? null,
      invoiceId: input.invoiceId ?? null,
      pdfUri: `rahhal://documents/invoice-bundle/${tripId}.pdf`,
      generatedAt: new Date().toISOString(),
    }

    return {
      itinerary,
      bookingSummary,
      hotelVoucher,
      eTicket,
      boardingPass,
      pdfItinerary,
      paymentReceiptId: input.paymentReceiptId ?? null,
      invoiceBundle,
    }
  }
}

export function createTripDocuments(): TripDocuments {
  return new TripDocuments()
}
