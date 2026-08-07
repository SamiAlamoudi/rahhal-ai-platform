import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FlightCard } from '../../design-system'
import {
  composeRecommendation,
  progressiveConsultantAck,
} from '../bilamo/intelligence/consultantComposer'
import { createClassicBilamoTransport } from '../bilamo/voice/classicTransport'
import { resolveVoiceTransportMode } from '../bilamo/voice/bilamoVoiceTransport'
import type { TripRequirements } from '../agent/types'
import type { BilamoSearchBundle } from '../bilamo/intelligence/types'

vi.mock('../chat/voice/audioElementTextToSpeechProvider', () => ({
  unlockAudioPlayback: vi.fn(async () => undefined),
  preconnectOpenAiTtsRoute: vi.fn(),
}))

vi.mock('../chat/voice/voiceProviderFactory', () => ({
  createTextToSpeechProvider: () => ({
    providerId: 'mock-tts',
    isSupported: () => true,
    prefetch: vi.fn(),
    speak: vi.fn(async (opts: { onAudioPlaybackStart?: () => void }) => {
      opts.onAudioPlaybackStart?.()
    }),
    stop: vi.fn(),
    isSpeaking: () => false,
  }),
}))

function sampleSearch(): BilamoSearchBundle {
  return {
    flights: [
      {
        id: 'f1',
        airline: 'Turkish Airlines',
        origin: 'RUH',
        destination: 'IST',
        departTime: '08:40',
        arriveTime: '12:20',
        duration: '3h 40m',
        stopsLabel: 'Nonstop',
        price: 2660,
        currency: 'SAR',
        reason: 'أنصح بهذه الرحلة المباشرة لأنها توفر نحو ساعتين مقابل زيادة بسيطة في السعر.',
        kindLabel: 'أفضل خيار',
        score: 92,
        baggageSummary: '1 cabin',
      },
      {
        id: 'f2',
        airline: 'Saudia',
        origin: 'RUH',
        destination: 'IST',
        departTime: '06:10',
        arriveTime: '11:50',
        duration: '4h 40m',
        stopsLabel: '1 stop',
        price: 2100,
        currency: 'SAR',
        reason: 'أقل سعراً مع توقف قصير.',
        kindLabel: 'الأرخص',
        score: 80,
        baggageSummary: '1 checked',
      },
      {
        id: 'f3',
        airline: 'Flynas',
        origin: 'RUH',
        destination: 'IST',
        departTime: '09:00',
        arriveTime: '12:10',
        duration: '3h 10m',
        stopsLabel: 'Nonstop',
        price: 2890,
        currency: 'SAR',
        reason: 'الأسرع إقلاعاً ووصولاً.',
        kindLabel: 'الأسرع',
        score: 86,
        baggageSummary: '1 cabin',
      },
    ],
    hotels: [],
    timeline: [],
    context: {},
    flightsMeta: { mode: 'demo', error: null, stale: false, bestScore: 92 },
  } as unknown as BilamoSearchBundle
}

const requirements = {
  destination: 'Istanbul',
  destinations: ['Istanbul'],
  origin: 'Riyadh',
} as TripRequirements

describe('Bilamo voice + results hardening', () => {
  it('keeps recommendation prose short — cards are the source of truth', () => {
    const copy = composeRecommendation({
      requirements,
      search: sampleSearch(),
      locale: 'ar',
    })
    expect(copy.displayText).toMatch(/أختاره|أقترح|إسطنبول|Istanbul|dest/i)
    expect(copy.displayText).not.toMatch(/Turkish Airlines.*2660/)
    expect(copy.displayText.split('\n\n').length).toBeLessThanOrEqual(2)
    expect(copy.spokenText.length).toBeGreaterThan(8)
  })

  it('emits progressive Arabic acknowledgements quickly', () => {
    expect(progressiveConsultantAck('ar', 0)).toMatch(/تمام|فهمت/)
    expect(progressiveConsultantAck('ar', 1)).toMatch(/أبحث/)
    expect(progressiveConsultantAck('ar', 2)).toMatch(/خيارات/)
    expect(progressiveConsultantAck('en', 0)).toMatch(/Got it/i)
  })

  it('renders Arabic premium hero FlightCard without English bag/score chrome', () => {
    const el = createElement(FlightCard, {
      airline: 'Turkish Airlines',
      origin: 'RUH',
      destination: 'IST',
      departTime: '08:40',
      arriveTime: '12:20',
      duration: '3h 40m',
      stopsLabel: 'Nonstop',
      priceLabel: '2,660 ر.س',
      reason: 'أنصح بهذه الرحلة المباشرة.',
      kindLabel: 'أفضل خيار',
      score: 92,
      baggageSummary: '1 cabin',
      highlighted: true,
      variant: 'hero',
      locale: 'ar',
      onSelect: () => undefined,
      onCompare: () => undefined,
      onViewDetails: () => undefined,
    })
    expect(el.type).toBe(FlightCard)
    expect(el.props.locale).toBe('ar')
    expect(el.props.variant).toBe('hero')
    expect(el.props.kindLabel).toBe('أفضل خيار')
  })

  it('classic speak waits for playback before claiming speaking, and surfaces autoplay errors', async () => {
    const transport = createClassicBilamoTransport()
    const events: string[] = []
    transport.setCallbacks({
      onSpeakingStart: () => events.push('start'),
      onSpeakingEnd: () => events.push('end'),
      onError: (message, detail) => events.push(`err:${detail?.code}:${message}`),
    })
    await transport.connect()
    const handle = transport.speak({ text: 'مرحبا', locale: 'ar' })
    // Must not be speaking synchronously before async playback begins.
    expect(transport.isSpeaking()).toBe(false)
    await handle.done
    expect(events).toContain('start')
    expect(events).toContain('end')
  })

  it('resolves VITE_VOICE_TRANSPORT modes without a third architecture', () => {
    expect(resolveVoiceTransportMode('realtime')).toBe('realtime')
    expect(resolveVoiceTransportMode('classic')).toBe('classic')
    expect(resolveVoiceTransportMode('auto')).toBe('auto')
    expect(resolveVoiceTransportMode(undefined)).toBe('auto')
  })

  it('does not read VITE_OPENAI_API_KEY in bilamo voice factories', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(import.meta.dirname, '../bilamo/voice')
    const files = [
      'createBilamoVoiceTransport.ts',
      'classicTransport.ts',
      'realtimeWebRtcTransport.ts',
      'bilamoVoiceSession.ts',
    ]
    for (const name of files) {
      const body = fs.readFileSync(path.join(root, name), 'utf8')
      expect(body).not.toMatch(/VITE_OPENAI_API_KEY/)
      expect(body).not.toMatch(/sk-proj-|sk-[a-zA-Z0-9]{20,}/)
    }
  })
})
