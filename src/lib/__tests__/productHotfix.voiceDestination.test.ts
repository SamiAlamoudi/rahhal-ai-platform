/**
 * Product validation hotfixes — Safari STT restart + Morocco trip context.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWebSpeechToTextProvider,
  prefersSafariSpeechRestart,
} from '../chat/voice/webSpeechToTextProvider'
import {
  createVoiceSession,
  DEFAULT_NO_TRANSCRIPT_TIMEOUT_MS,
} from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import {
  buildDynamicResultCards,
  inferTravelRouteFromSeed,
} from '../premiumExperience'
import {
  buildActiveTripContext,
  demoItinerary,
  isStaleTripRoute,
  tripClarificationText,
} from '../productUx'

const MOROCCO_COUNTRY_SEED =
  'أريد أن أسافر إلى المغرب مع زوجتي لمدة أسبوع بميزانية 10,000 ريال'
const MOROCCO_CITY_SEED =
  'أريد أن أسافر إلى مراكش مع زوجتي لمدة أسبوع بميزانية 10,000 ريال'

type HandlerMap = {
  onresult: ((ev: unknown) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
}

type MockRecognition = HandlerMap & {
  lang: string
  continuous: boolean
  interimResults: boolean
  started: number
  stop: () => void
  abort: () => void
  start: () => void
}

describe('prefersSafariSpeechRestart', () => {
  it('detects iPhone Safari and desktop Safari', () => {
    expect(
      prefersSafariSpeechRestart(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true)
    expect(
      prefersSafariSpeechRestart(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      ),
    ).toBe(true)
  })

  it('does not force restart loop for Chrome', () => {
    expect(
      prefersSafariSpeechRestart(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe(false)
  })
})

describe('webSpeechToTextProvider Safari continuous restart', () => {
  const instances: MockRecognition[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    instances.length = 0

    class MockSpeechRecognition {
      lang = ''
      continuous = true
      interimResults = false
      onresult: HandlerMap['onresult'] = null
      onerror: HandlerMap['onerror'] = null
      onend: HandlerMap['onend'] = null
      started = 0

      constructor() {
        instances.push(this as unknown as MockRecognition)
      }

      start() {
        this.started += 1
      }

      stop() {
        this.onend?.()
      }

      abort() {
        this.onerror?.({ error: 'aborted' })
        this.onend?.()
      }
    }

    const nav = {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      maxTouchPoints: 5,
    }
    vi.stubGlobal('navigator', nav)
    vi.stubGlobal('window', {
      SpeechRecognition: MockSpeechRecognition,
      webkitSpeechRecognition: MockSpeechRecognition,
      navigator: nav,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('forces continuous=false on iPhone Safari, uses ar-SA, and restarts without bubbling onEnd', async () => {
    const provider = createWebSpeechToTextProvider()
    const ends: number[] = []
    const finals: string[] = []
    provider.onEnd = () => {
      ends.push(1)
    }
    provider.onFinal = (event) => {
      finals.push(event.transcript)
    }

    await provider.start({
      locale: 'ar',
      continuous: true,
      interimResults: true,
    })

    expect(instances).toHaveLength(1)
    expect(instances[0]!.continuous).toBe(false)
    expect(instances[0]!.lang).toBe('ar-SA')
    expect(instances[0]!.started).toBe(1)

    instances[0]!.onresult?.({
      resultIndex: 0,
      results: {
        length: 1,
        0: {
          isFinal: true,
          0: { transcript: 'رحلة إلى المغرب' },
          length: 1,
        },
      },
    })
    expect(finals).toEqual(['رحلة إلى المغرب'])

    instances[0]!.onend?.()
    expect(ends).toEqual([])

    await vi.advanceTimersByTimeAsync(200)
    expect(instances[0]!.started).toBe(2)

    const stopped = await provider.stop()
    expect(stopped).toContain('المغرب')
    expect(ends.length).toBeGreaterThanOrEqual(1)
  })

  it('ignores transient no-speech while Safari restart loop is active', async () => {
    const provider = createWebSpeechToTextProvider()
    const errors: string[] = []
    provider.onError = (error) => {
      errors.push(error)
    }

    await provider.start({
      locale: 'ar',
      continuous: true,
      interimResults: true,
    })
    instances[0]!.onerror?.({ error: 'no-speech' })
    expect(errors).toEqual([])
    provider.abort()
  })
})

describe('voiceSession no-transcript timeout + typed fallback', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('never stays stuck listening without a transcript; suggests typed input', async () => {
    vi.useFakeTimers()
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    const typedReasons: string[] = []

    const session = createVoiceSession({
      stt,
      tts,
      requestPermission: async () => ({ state: 'granted', error: null }),
      noTranscriptTimeoutMs: DEFAULT_NO_TRANSCRIPT_TIMEOUT_MS,
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
      callbacks: {
        onStatus: (s) => statuses.push(s),
        onSuggestTypedInput: (reason) => typedReasons.push(reason),
      },
    })

    await session.startHandsFree('c1')
    expect(session.getStatus()).toBe('listening')

    await vi.advanceTimersByTimeAsync(DEFAULT_NO_TRANSCRIPT_TIMEOUT_MS + 50)
    expect(session.getStatus()).toBe('error')
    expect(typedReasons.length).toBeGreaterThan(0)
    expect(typedReasons[0]).toMatch(/الكتابة/)
    expect(statuses).toContain('error')
    session.dispose()
  })

  it('clears no-transcript timeout once speech is heard', async () => {
    vi.useFakeTimers()
    const { provider: stt, controller } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const typedReasons: string[] = []

    const session = createVoiceSession({
      stt,
      tts,
      requestPermission: async () => ({ state: 'granted', error: null }),
      silenceTimeoutMs: 2500,
      noTranscriptTimeoutMs: 5000,
      activityMonitor: {
        start: async () => {},
        stop: () => {},
        isSpeaking: () => false,
        getLevel: () => 0,
        isActive: () => false,
      },
      callbacks: {
        onSuggestTypedInput: (reason) => typedReasons.push(reason),
      },
      sendTurn: vi.fn(async (_input, handlers) => {
        const assistant = {
          id: 'a1',
          conversationId: 'c1',
          role: 'assistant' as const,
          modality: 'text' as const,
          content: 'ok',
          audioUrl: null,
          imageUrl: null,
          attachments: [],
          status: 'complete' as const,
          error: null,
          providerMeta: {},
          createdAt: '2026-07-15T00:00:00.000Z',
          updatedAt: '2026-07-15T00:00:00.000Z',
        }
        await handlers.onComplete?.(assistant)
        return {
          user: { ...assistant, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'مرحبا' },
          assistant,
        }
      }) as never,
    })

    await session.startHandsFree('c1')
    controller.emitFinal('مرحبا')
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(6000)
    expect(typedReasons).toEqual([])
    session.dispose()
  })
})

describe('Morocco trip destination consistency', () => {
  it('asks one city clarification for Morocco country-only seed (no invented RAK/Dubai)', () => {
    const trip = buildActiveTripContext(MOROCCO_COUNTRY_SEED)
    expect(trip.needsCityClarification).toBe(true)
    expect(trip.budgetSar).toBe(10000)
    expect(trip.currency).toBe('SAR')
    expect(trip.travelers).toBe(2)
    expect(trip.durationDays).toBe(7)
    expect(trip.destinationCode).toBeNull()
    expect(tripClarificationText(trip, 'ar')).toMatch(/مدينة/)

    const route = inferTravelRouteFromSeed(MOROCCO_COUNTRY_SEED)
    expect(route.needsCityClarification).toBe(true)
    expect(buildDynamicResultCards(MOROCCO_COUNTRY_SEED, 6)).toEqual([])
  })

  it('never renders Riyadh → Dubai for the Morocco country seed', () => {
    const cards = buildDynamicResultCards(MOROCCO_COUNTRY_SEED, 8)
    expect(cards).toEqual([])
    const trip = buildActiveTripContext(MOROCCO_COUNTRY_SEED)
    expect(isStaleTripRoute(trip, 'الرياض → دبي', 'RUH → DXB')).toBe(true)
  })

  it('aligns flight/hotel/activity/restaurant/budget/itinerary to Marrakech + SAR', () => {
    const trip = buildActiveTripContext(MOROCCO_CITY_SEED)
    expect(trip.needsCityClarification).toBe(false)
    expect(trip.destinationCode).toBe('RAK')
    expect(trip.displayDestinationAr).toBe('مراكش')
    expect(trip.budgetSar).toBe(10000)
    expect(trip.currency).toBe('SAR')

    const cards = buildDynamicResultCards(MOROCCO_CITY_SEED, 8)
    const blob = cards.map((c) => `${c.titleAr} ${c.titleEn} ${c.metaAr} ${c.metaEn}`).join(' ')
    expect(blob).not.toMatch(/دبي|Dubai|DXB/i)
    expect(blob).toMatch(/مراكش|Marrakech|RAK/)
    expect(blob).toMatch(/SAR|ر\.س/)

    const flight = cards.find((c) => c.kind === 'flight')
    expect(flight?.titleAr).toBe('الرياض → مراكش')
    expect(flight?.titleEn).toBe('RUH → RAK')

    const hotel = cards.find((c) => c.kind === 'hotel')
    expect(hotel?.titleAr).toContain('مراكش')

    const activity = cards.find((c) => c.kind === 'activity')
    const restaurant = cards.find((c) => c.kind === 'restaurant')
    // kinds may be filtered by seed keywords; ensure route-level demos stay Morocco when present
    if (activity) expect(activity.titleAr).toContain('مراكش')
    if (restaurant) expect(restaurant.titleAr).toContain('مراكش')

    const itinerary = demoItinerary('ar', trip)
    const itineraryText = JSON.stringify(itinerary)
    expect(itineraryText).toContain('مراكش')
    expect(itineraryText).not.toMatch(/دبي|Dubai/)
  })

  it('rejects stale Dubai structured labels on a Morocco trip', () => {
    const trip = buildActiveTripContext(MOROCCO_CITY_SEED)
    expect(isStaleTripRoute(trip, 'Emirates', 'الرياض', 'دبي')).toBe(true)
    expect(isStaleTripRoute(trip, 'فندق مراكش', 'مراكش', 'Marrakech')).toBe(false)
  })
})
