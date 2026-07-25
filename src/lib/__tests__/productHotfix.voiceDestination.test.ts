/**
 * Product validation hotfixes — Safari STT restart + Morocco route cards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWebSpeechToTextProvider,
  prefersSafariSpeechRestart,
} from '../chat/voice/webSpeechToTextProvider'
import {
  buildDynamicResultCards,
  inferTravelRouteFromSeed,
} from '../premiumExperience'

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

  it('forces continuous=false on iPhone Safari and restarts without bubbling onEnd', async () => {
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

    // Simulate a final transcript then Safari ending the one-shot turn.
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

describe('Morocco destination cards', () => {
  it('infers Morocco from Arabic seed text', () => {
    const route = inferTravelRouteFromSeed('خطّط رحلة خمسة أيام إلى المغرب')
    expect(route.destinationAr).toBe('المغرب')
    expect(route.destinationEn).toBe('Morocco')
    expect(route.originAr).toBe('الرياض')
  })

  it('does not render Riyadh → Dubai for a Morocco trip seed', () => {
    const cards = buildDynamicResultCards('خطّط رحلة خمسة أيام إلى المغرب', 4)
    const flight = cards.find((c) => c.kind === 'flight')
    expect(flight).toBeTruthy()
    expect(flight!.titleAr).toBe('الرياض → المغرب')
    expect(flight!.titleEn).toBe('RUH → RAK')
    expect(flight!.titleAr).not.toContain('دبي')
    expect(flight!.titleEn).not.toMatch(/DXB|Dubai/i)
  })
})
