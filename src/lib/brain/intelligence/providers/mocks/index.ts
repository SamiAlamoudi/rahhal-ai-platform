/**
 * Sprint 53 — remaining mock live providers (weather, visa, events, safety, FX, transport, price watch).
 */

import { findDestinationProfile } from '../../../../agent/reasoning/destinationCatalog'
import { emitLiveEvent } from '../../eventBus'
import type {
  EventSignal,
  ExchangeSignal,
  LiveQuery,
  PriceWatchSignal,
  SafetySignal,
  TransportSignal,
  VisaSignal,
  WeatherSignal,
} from '../../types'
import { hashSeed, money, pick } from '../mockUtils'
import { createSignalProvider } from './signalFactory'

function dest(query: LiveQuery): string {
  return query.destination ?? 'Istanbul'
}

export function createMockWeatherProvider() {
  return createSignalProvider<WeatherSignal>({
    providerId: 'mock.weather',
    domain: 'weather',
    name: 'Mock Weather Intelligence',
    search(query) {
      const destination = dest(query)
      const profile = findDestinationProfile(destination)
      const month = query.startDate ? new Date(query.startDate).getUTCMonth() : new Date().getUTCMonth()
      const band = profile?.climateByMonth[month] ?? 'mild'
      const currentC = band === 'hot' ? 34 : band === 'warm' ? 27 : band === 'mild' ? 20 : band === 'cool' ? 12 : 3
      const rainChance = band === 'cold' || band === 'cool' ? 0.35 : 0.15
      const signal: WeatherSignal = {
        destination,
        currentC,
        condition: band === 'hot' ? 'clear' : band === 'cold' ? 'cloudy' : 'partly_cloudy',
        forecast: [0, 1, 2, 3, 4].map((d) => ({
          day: `D+${d}`,
          highC: currentC + 2,
          lowC: currentC - 6,
          rainChance,
          condition: rainChance > 0.3 ? 'showers' : 'clear',
        })),
        humidity: 45 + (hashSeed(destination) % 30),
        airQualityIndex: 40 + (hashSeed(destination) % 40),
        windKph: 8 + (hashSeed(destination) % 20),
        uvIndex: band === 'hot' ? 9 : 5,
        seasonAlert: band === 'hot' ? 'heat_advisory' : band === 'cold' ? 'cold_snap' : null,
        travelSuitability: band === 'mild' || band === 'warm' ? 0.9 : 0.65,
        confidence: 0.88,
      }
      emitLiveEvent({
        type: 'WeatherChanged',
        domain: 'weather',
        providerId: 'mock.weather',
        at: new Date().toISOString(),
        payload: { destination, currentC, band },
      })
      return signal
    },
  })
}

export function createMockVisaProvider() {
  return createSignalProvider<VisaSignal>({
    providerId: 'mock.visa',
    domain: 'visa',
    name: 'Mock Visa Intelligence',
    search(query) {
      const destination = dest(query)
      const nationality = query.nationality ?? 'SA'
      const profile = findDestinationProfile(destination)
      const requirement = profile?.visaFromSaudi ?? 'evisa'
      const processingDays =
        requirement === 'visa_free' ? 0
          : requirement === 'visa_on_arrival' ? 0
            : requirement === 'evisa' ? 3
              : 14
      const signal: VisaSignal = {
        destination,
        nationality,
        requirement,
        transitVisaRequired: requirement === 'embassy',
        processingDays,
        requiredDocuments:
          requirement === 'visa_free'
            ? ['passport']
            : requirement === 'embassy'
              ? ['passport', 'photo', 'bank_statement', 'invitation']
              : ['passport', 'photo'],
        validityDays: requirement === 'embassy' ? 90 : 30,
        warnings: requirement === 'embassy'
          ? ['Embassy appointment required before tickets']
          : [],
        confidence: 0.91,
      }
      emitLiveEvent({
        type: 'VisaUpdated',
        domain: 'visa',
        providerId: 'mock.visa',
        at: new Date().toISOString(),
        payload: { destination, requirement },
      })
      return signal
    },
  })
}

export function createMockEventProvider() {
  return createSignalProvider<EventSignal>({
    providerId: 'mock.event',
    domain: 'event',
    name: 'Mock Event Intelligence',
    search(query) {
      const destination = dest(query)
      const seed = hashSeed(destination + (query.startDate ?? ''))
      const peak = seed % 3 === 0
      return {
        destination,
        holidays: pick(seed, [['National Day'], ['New Year'], ['Local Holiday']]),
        festivals: pick(seed + 1, [['Food Festival'], ['Music Week'], ['Culture Fair']]),
        conferences: seed % 2 === 0 ? ['Tech Summit'] : [],
        sportEvents: seed % 4 === 0 ? ['League Match'] : [],
        schoolVacations: peak,
        peakSeason: peak,
        trafficImpact: peak ? 'high' : 'low',
        hotelDemand: peak ? 'high' : 'medium',
        confidence: 0.8,
      } satisfies EventSignal
    },
  })
}

export function createMockSafetyProvider() {
  return createSignalProvider<SafetySignal>({
    providerId: 'mock.safety',
    domain: 'safety',
    name: 'Mock Safety Intelligence',
    search(query) {
      const destination = dest(query)
      const profile = findDestinationProfile(destination)
      const riskHints = profile?.risks ?? []
      const advisoryLevel =
        riskHints.some((r) => r.includes('storm') || r.includes('mountain')) ? 'watch'
          : 'none'
      if (advisoryLevel !== 'none') {
        emitLiveEvent({
          type: 'TripAffected',
          domain: 'safety',
          providerId: 'mock.safety',
          at: new Date().toISOString(),
          payload: { destination, advisoryLevel },
        })
      }
      return {
        destination,
        advisoryLevel,
        naturalDisasters: riskHints.filter((r) => /storm|weather|mountain|flood/.test(r)),
        politicalRisk: 0.12 + (hashSeed(destination) % 20) / 100,
        diseaseOutbreaks: [],
        airportDisruption: null,
        securityAlerts: [],
        confidence: 0.87,
      } satisfies SafetySignal
    },
  })
}

export function createMockExchangeProvider() {
  return createSignalProvider<ExchangeSignal>({
    providerId: 'mock.exchange',
    domain: 'exchange',
    name: 'Mock Exchange Intelligence',
    search(query) {
      const base = 'SAR'
      const quote = query.currency && query.currency !== 'SAR' ? query.currency : 'USD'
      const rate = quote === 'USD' ? 0.266 : quote === 'EUR' ? 0.245 : 1
      const dailyChangePct = ((hashSeed(quote) % 21) - 10) / 100
      const trend7d = dailyChangePct > 0.03 ? 'up' : dailyChangePct < -0.03 ? 'down' : 'stable'
      const budget = query.budgetAmount ?? null
      emitLiveEvent({
        type: 'ExchangeRateChanged',
        domain: 'exchange',
        providerId: 'mock.exchange',
        at: new Date().toISOString(),
        payload: { base, quote, rate, dailyChangePct },
      })
      return {
        base,
        quote,
        rate,
        dailyChangePct,
        trend7d,
        budgetConverted: budget != null ? money(budget * rate, quote) : null,
        spendingForecast: budget != null ? money(budget * rate * 0.92, quote) : null,
        confidence: 0.93,
      } satisfies ExchangeSignal
    },
  })
}

export function createMockTransportProvider() {
  return createSignalProvider<TransportSignal>({
    providerId: 'mock.transport',
    domain: 'transport',
    name: 'Mock Transport Intelligence',
    search(query) {
      const destination = dest(query)
      const seed = hashSeed(destination)
      return {
        destination,
        options: [
          {
            mode: 'airport_transfer',
            etaMinutes: 35 + (seed % 20),
            price: money(120 + (seed % 80)),
            notes: 'Private transfer',
          },
          {
            mode: 'metro',
            etaMinutes: 45 + (seed % 15),
            price: money(15),
            notes: 'Airport line',
          },
          {
            mode: 'uber',
            etaMinutes: 30 + (seed % 25),
            price: money(70 + (seed % 40)),
            notes: 'Ride-hail estimate',
          },
          {
            mode: 'taxi',
            etaMinutes: 32 + (seed % 18),
            price: money(90 + (seed % 50)),
            notes: 'Official taxi',
          },
          {
            mode: 'rental',
            etaMinutes: 20,
            price: money(180 + (seed % 60)),
            notes: 'Daily rental',
          },
        ],
        confidence: 0.82,
      } satisfies TransportSignal
    },
  })
}

export function createMockPriceWatchProvider() {
  return createSignalProvider<PriceWatchSignal>({
    providerId: 'mock.price_watch',
    domain: 'price_watch',
    name: 'Mock Price Watch',
    search(query) {
      const destination = dest(query)
      const seed = hashSeed(destination + (query.startDate ?? ''))
      const flightNow = 1400 + (seed % 400)
      const hotelNow = 520 + (seed % 200)
      const flightPrev = flightNow + ((seed % 2 === 0) ? 120 : -90)
      const hotelPrev = hotelNow + ((seed % 3 === 0) ? 40 : -55)
      const flightChange = ((flightNow - flightPrev) / flightPrev) * 100
      const hotelChange = ((hotelNow - hotelPrev) / hotelPrev) * 100
      if (Math.abs(flightChange) >= 5) {
        emitLiveEvent({
          type: 'PriceChanged',
          domain: 'price_watch',
          providerId: 'mock.price_watch',
          at: new Date().toISOString(),
          payload: { kind: 'flight', changePct: flightChange },
        })
      }
      return {
        watches: [
          {
            kind: 'flight',
            label: `${query.origin ?? 'RUH'} → ${destination}`,
            current: money(flightNow),
            previous: money(flightPrev),
            changePct: Number(flightChange.toFixed(1)),
            inventoryLimited: seed % 5 === 0,
            notify: flightChange <= -5 ? 'drop' : flightChange >= 5 ? 'rise' : seed % 5 === 0 ? 'limited' : null,
          },
          {
            kind: 'hotel',
            label: `${destination} stay`,
            current: money(hotelNow),
            previous: money(hotelPrev),
            changePct: Number(hotelChange.toFixed(1)),
            inventoryLimited: seed % 7 === 0,
            notify: hotelChange <= -5 ? 'drop' : hotelChange >= 5 ? 'rise' : null,
          },
          {
            kind: 'package',
            label: `${destination} package`,
            current: money(flightNow + hotelNow * 4),
            previous: money(flightPrev + hotelPrev * 4),
            changePct: Number((((flightNow + hotelNow * 4) - (flightPrev + hotelPrev * 4)) / (flightPrev + hotelPrev * 4) * 100).toFixed(1)),
            inventoryLimited: false,
            notify: null,
          },
        ],
        confidence: 0.85,
      } satisfies PriceWatchSignal
    },
  })
}
