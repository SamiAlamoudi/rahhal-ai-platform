import { describe, expect, it } from 'vitest'
import {
  AMADEUS_SANDBOX_HOST,
  buildAmadeusSandboxBookingUrl,
  describeAmadeusSandboxReadiness,
  isAmadeusSandboxHost,
} from '../amadeusSandbox'
import { normalizeAmadeusFlightOffer } from '../flightNormalization'
import { isSafeBookingUrl } from '../../../../lib/booking/bookingAction'
import type { AmadeusFlightOffer, AmadeusDictionaries } from '../amadeusFlightApiClient'

const SAMPLE_OFFER = {
  id: 'offer-sandbox-1',
  source: 'GDS',
  instantTicketingRequired: false,
  nonHomogeneous: false,
  oneWay: true,
  lastTicketingDate: '2026-08-01',
  numberOfBookableSeats: 4,
  itineraries: [
    {
      duration: 'PT10H30M',
      segments: [
        {
          id: '1',
          departure: { iataCode: 'RUH', at: '2026-10-15T01:30:00' },
          arrival: { iataCode: 'NRT', at: '2026-10-15T17:30:00' },
          carrierCode: 'JL',
          number: '462',
          aircraft: { code: '359' },
          duration: 'PT10H30M',
          numberOfStops: 0,
          blacklistedInEU: false,
        },
      ],
    },
  ],
  price: { currency: 'SAR', total: '5500.00', base: '6500.00' },
  pricingOptions: { fareType: ['PUBLISHED'], includedCheckedBagsOnly: true, refundableFare: true },
  validatingAirlineCodes: ['JL'],
  travelerPricings: [
    {
      travelerId: '1',
      fareOption: 'STANDARD',
      travelerType: 'ADULT',
      price: { currency: 'SAR', total: '5500.00', base: '6500.00' },
      fareDetailsBySegment: [
        {
          segmentId: '1',
          cabin: 'ECONOMY',
          class: 'M',
          includedCheckedBags: { quantity: 1 },
        },
      ],
    },
  ],
} as unknown as AmadeusFlightOffer

const DICTS = {
  carriers: { JL: 'JAL' },
  aircraft: { '359': 'Airbus A350' },
} as AmadeusDictionaries

describe('Amadeus sandbox funnel helpers', () => {
  it('recognizes sandbox host and defaults unset host to sandbox', () => {
    expect(isAmadeusSandboxHost(AMADEUS_SANDBOX_HOST)).toBe(true)
    expect(isAmadeusSandboxHost(null)).toBe(true)
    expect(isAmadeusSandboxHost('https://api.amadeus.com')).toBe(false)
  })

  it('builds a safe HTTPS booking deep-link with offer id', () => {
    const url = buildAmadeusSandboxBookingUrl('offer-sandbox-1', {
      host: AMADEUS_SANDBOX_HOST,
    })
    expect(isSafeBookingUrl(url)).toBe(true)
    expect(url).toContain('offerId=offer-sandbox-1')
    expect(url).toContain('env=sandbox')
  })

  it('attaches bookingUrl during Amadeus offer normalization', () => {
    const offer = normalizeAmadeusFlightOffer(SAMPLE_OFFER, DICTS, 'amadeus-flight-001', {
      host: AMADEUS_SANDBOX_HOST,
    })
    expect(offer.bookingUrl).toBeTruthy()
    expect(isSafeBookingUrl(offer.bookingUrl!)).toBe(true)
    expect(offer.bookingUrl).toContain('offer-sandbox-1')
  })

  it('reports sandbox readiness only when adapter + token proxy + sandbox host align', () => {
    const notReady = describeAmadeusSandboxReadiness({
      flightAdapter: 'mock',
      tokenUrl: null,
      invokeApiKey: null,
      baseUrl: null,
    })
    expect(notReady.ready).toBe(false)
    expect(notReady.sandboxHost).toBe(true)

    const ready = describeAmadeusSandboxReadiness({
      flightAdapter: 'amadeus',
      tokenUrl: 'https://example.supabase.co/functions/v1/amadeus-token',
      invokeApiKey: 'anon',
      baseUrl: AMADEUS_SANDBOX_HOST,
    })
    expect(ready.ready).toBe(true)
    expect(ready.host).toContain('test.api.amadeus.com')

    const vercelReady = describeAmadeusSandboxReadiness({
      flightAdapter: 'amadeus',
      tokenUrl: '/api/amadeus-token',
      invokeApiKey: null,
      baseUrl: AMADEUS_SANDBOX_HOST,
    })
    expect(vercelReady.ready).toBe(true)
    expect(vercelReady.tokenProxyConfigured).toBe(true)
  })
})
