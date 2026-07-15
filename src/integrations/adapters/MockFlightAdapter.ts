import type { FlightProvider, FlightOffer, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'

const METADATA: ProviderMetadata = {
  id: 'mock-flight-001',
  name: 'Mock Flight Provider',
  priority: 1,
  enabled: true,
  type: 'flight',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsCancellation: true,
  supportsPriceTracking: true,
}

function buildOffers(): FlightOffer[] {
  return [
    {
      id: 'JAL-462',
      providerId: 'mock-flight-001',
      title: 'JAL 462: الرياض → طوكيو (مباشر)',
      currency: 'SAR',
      price: 8500,
      originalPrice: 10000,
      rating: 4.7,
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 24h',
      itinerary: {
        segments: [
          {
            origin: 'RUH',
            destination: 'NRT',
            departure: '2026-10-15T01:30',
            arrival: '2026-10-15T17:30',
            carrier: 'JAL',
            flightNumber: 'JAL462',
            aircraft: null,
            cabin: 'business',
            durationMinutes: 600,
          },
        ],
        totalDuration: 600,
        stops: 0,
        refundable: true,
        baggageIncluded: true,
      },
    },
    {
      id: 'QR-1166',
      providerId: 'mock-flight-001',
      title: 'QR 1166: الرياض → طوكيو (توقف واحد)',
      currency: 'SAR',
      price: 5500,
      originalPrice: 7000,
      rating: 4.5,
      familyFriendly: true,
      cancellationPolicy: 'non-refundable',
      itinerary: {
        segments: [
          {
            origin: 'RUH',
            destination: 'NRT',
            departure: '2026-10-15T08:00',
            arrival: '2026-10-15T22:10',
            carrier: 'Qatar Airways',
            flightNumber: 'QR1166',
            aircraft: null,
            cabin: 'economy',
            durationMinutes: 850,
          },
        ],
        totalDuration: 850,
        stops: 1,
        refundable: false,
        baggageIncluded: true,
      },
    },
    {
      id: 'SV-842',
      providerId: 'mock-flight-001',
      title: 'SV 842: الرياض → طوكيو (توقف واحد)',
      currency: 'SAR',
      price: 4800,
      originalPrice: null,
      rating: 4.0,
      familyFriendly: true,
      cancellationPolicy: 'free cancellation 48h',
      itinerary: {
        segments: [
          {
            origin: 'RUH',
            destination: 'HND',
            departure: '2026-10-15T06:00',
            arrival: '2026-10-15T21:00',
            carrier: 'Saudia',
            flightNumber: 'SV842',
            aircraft: null,
            cabin: 'economy',
            durationMinutes: 900,
          },
        ],
        totalDuration: 900,
        stops: 1,
        refundable: true,
        baggageIncluded: false,
      },
    },
  ]
}

export class MockFlightAdapter implements FlightProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async searchFlights(_req: ProviderRequest): Promise<ProviderResult<FlightOffer[]>> {
    const start = Date.now()
    const data = this.sampleOffers(_req)
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }

  sampleOffers(_req: ProviderRequest): FlightOffer[] {
    return buildOffers()
  }
}
