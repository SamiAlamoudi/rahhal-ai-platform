/**
 * P0 human Safari gate regressions — route validation, Arabic timeline, consultant copy.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { resolveAirportCode } from '../agent/airportCodes'
import type { TripRequirements } from '../agent/types'
import { composeRecommendation } from '../bilamo/intelligence/consultantComposer'
import {
  canonicalizeAirportCode,
  validateFlightRoute,
} from '../bilamo/intelligence/flightRouteValidation'
import { runBilamoSearchOrchestrator } from '../bilamo/intelligence/searchOrchestrator'
import {
  createBilamoVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
  USER_SAFE_RECONNECT_COPY,
} from '../bilamo/voice/bilamoVoiceSession'
import type {
  BilamoSpeakHandle,
  BilamoVoiceConnectionState,
  BilamoVoiceTransport,
  BilamoVoiceTransportCallbacks,
} from '../bilamo/voice/bilamoVoiceTransport'

function makeFakeTransport(): BilamoVoiceTransport & {
  fireError: (message: string, detail?: { code?: string; recoverable?: boolean }) => void
  fireConnection: (state: BilamoVoiceConnectionState) => void
} {
  let callbacks: BilamoVoiceTransportCallbacks = {}
  const transport: BilamoVoiceTransport & {
    fireError: (message: string, detail?: { code?: string; recoverable?: boolean }) => void
    fireConnection: (state: BilamoVoiceConnectionState) => void
  } = {
    kind: 'realtime_webrtc',
    setCallbacks(next) {
      callbacks = next || {}
    },
    async connect() {
      callbacks.onConnectionStateChange?.('connected')
    },
    disconnect() {},
    async startListening() {
      callbacks.onListeningChange?.(true)
      return true
    },
    stopListening() {
      callbacks.onListeningChange?.(false)
    },
    cancelListening() {
      callbacks.onListeningChange?.(false)
    },
    finalizeListening() {},
    speak(): BilamoSpeakHandle {
      return { generation: 1, done: Promise.resolve() }
    },
    interrupt() {},
    stop() {},
    isSpeaking() {
      return false
    },
    isListening() {
      return false
    },
    isConnected() {
      return true
    },
    getConnectionState() {
      return 'connected'
    },
    dispose() {},
    fireError(message, detail) {
      callbacks.onError?.(message, detail)
    },
    fireConnection(state) {
      callbacks.onConnectionStateChange?.(state)
    },
  }
  return transport
}

describe('Safari human gate P0', () => {
  it('maps Riyadh / RIY to RUH and never invents RIY as a destination', () => {
    expect(resolveAirportCode('Riyadh')).toBe('RUH')
    expect(resolveAirportCode('RIY')).toBe('RUH')
    expect(canonicalizeAirportCode('RIY')).toBe('RUH')
  })

  it('rejects RUH→RIY and same-metro routes', () => {
    expect(validateFlightRoute('RUH', 'RIY').ok).toBe(false)
    expect(validateFlightRoute('RUH', 'RUH').ok).toBe(false)
    expect(validateFlightRoute('RUH', 'DXB').ok).toBe(true)
  })

  it('orchestrator never returns RUH→RIY when destination is Riyadh', async () => {
    const req = {
      destination: 'Riyadh',
      destinations: ['Riyadh'],
      origin: 'Riyadh',
      startDate: '2026-09-12',
      durationDays: 4,
      travelers: 1,
      budgetCurrency: 'SAR',
    } as TripRequirements
    const bundle = await runBilamoSearchOrchestrator({ requirements: req, locale: 'ar' })
    expect(bundle.flights).toHaveLength(0)
    expect(String(bundle.flightsMeta?.error || '')).toMatch(/same_city|same_airport|same_metro/)
  })

  it('timeline labels are Arabic-first for ar locale', async () => {
    const req = {
      destination: 'Dubai',
      destinations: ['Dubai'],
      origin: 'Riyadh',
      startDate: '2026-09-12',
      durationDays: 4,
      travelers: 1,
      budgetCurrency: 'SAR',
    } as TripRequirements
    const bundle = await runBilamoSearchOrchestrator({ requirements: req, locale: 'ar' })
    expect(bundle.timeline.some((t) => /اليوم الأول|الوصول|الانتقال/.test(`${t.time} ${t.title}`))).toBe(true)
    expect(bundle.timeline.every((t) => !t.time.startsWith('Day 1 ·'))).toBe(true)
  })

  it('recommendation copy is specific — not the generic pick loop', () => {
    const copy = composeRecommendation({
      requirements: {
        destination: 'دبي',
        destinations: ['دبي'],
        origin: 'RUH',
      } as TripRequirements,
      search: {
        flights: [{
          id: '1',
          airline: 'Emirates',
          origin: 'RUH',
          destination: 'DXB',
          departTime: '08:00',
          arriveTime: '11:00',
          duration: '3h',
          stopsLabel: 'مباشر',
          price: 1200,
          currency: 'SAR',
          reason: 'مباشر',
          score: 90,
        }],
        hotels: [],
        context: {
          weather: null, visa: null, currency: null, timeDifference: null, transfer: null,
        },
        timeline: [],
        flightsMeta: {
          mode: 'demo', error: null, stale: false, bestScore: 90, inventorySource: 'demo',
        },
      },
      locale: 'ar',
    })
    expect(copy.displayText).toMatch(/Emirates|دبي/)
    expect(copy.displayText).not.toBe('هذا ما أختاره لك.')
    expect(copy.displayText).toMatch(/عينة|تجريب|حية/)
  })

  it('documents that Connection lost is not the recoverable soft path copy', () => {
    expect(USER_SAFE_RECONNECT_COPY).toMatch(/Connection lost/)
  })

  it('recoverable realtime reconnect does not sticky-banner Connection lost', async () => {
    const fake = makeFakeTransport()
    const session = createBilamoVoiceSession({
      mode: 'realtime',
      createTransport: async () => ({
        transport: fake,
        mode: 'realtime' as const,
        selected: 'realtime_webrtc' as const,
        fellBack: false,
        reason: null,
      }),
    })
    await session.prepare()
    await session.connect()
    session.setContinuousListening(true)
    fake.fireError('reconnect_failed', { code: 'reconnect_failed', recoverable: true })
    await new Promise((r) => setTimeout(r, 120))
    const snap = session.getSnapshot()
    expect(snap.error).not.toBe(USER_SAFE_RECONNECT_COPY)
    expect(snap.error).toBeNull()
    session.dispose()
  })
})

afterEach(() => {
  resetSharedBilamoVoiceSessionForTests()
})

