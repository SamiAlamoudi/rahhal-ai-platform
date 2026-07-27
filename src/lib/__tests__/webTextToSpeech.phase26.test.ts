/**
 * Recovery Phase 2.6 — web SpeechSynthesis provider hardening.
 * Node env: stub minimal window.speechSynthesis (no happy-dom required).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebTextToSpeechProvider } from '../chat/voice/webTextToSpeechProvider'

type SynthMock = {
  speaking: boolean
  pending: boolean
  paused: boolean
  cancel: ReturnType<typeof vi.fn>
  speak: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  getVoices: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

class FakeUtterance {
  text: string
  lang = ''
  voice: unknown = null
  onstart: ((ev: Event) => void) | null = null
  onend: ((ev: Event) => void) | null = null
  onerror: ((ev: Event) => void) | null = null
  onpause: ((ev: Event) => void) | null = null
  onresume: ((ev: Event) => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

describe('Phase 2.6 — webTextToSpeechProvider', () => {
  let synth: SynthMock
  let lastUtterance: FakeUtterance | null
  const originalWindow = (globalThis as { window?: unknown }).window

  beforeEach(() => {
    vi.useFakeTimers()
    lastUtterance = null
    synth = {
      speaking: false,
      pending: false,
      paused: false,
      cancel: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn(() => [
        { lang: 'ar-SA', name: 'Arabic', localService: true, default: true, voiceURI: 'ar' },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      speak: vi.fn((utt: FakeUtterance) => {
        lastUtterance = utt
        synth.speaking = true
        queueMicrotask(() => {
          utt.onstart?.(new Event('start'))
        })
      }),
    }
    ;(globalThis as { window: unknown }).window = {
      speechSynthesis: synth,
      setTimeout: (...args: Parameters<typeof setTimeout>) => setTimeout(...args),
      SpeechSynthesisUtterance: FakeUtterance,
    }
    ;(globalThis as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window
    } else {
      ;(globalThis as { window: unknown }).window = originalWindow
    }
  })

  it('does not speak after stop() during waitForVoices', async () => {
    synth.getVoices.mockReturnValue([])
    const tts = createWebTextToSpeechProvider()
    const speakPromise = tts.speak({
      locale: 'ar',
      text: 'مرحبا بالعالم',
      interrupt: true,
    })
    // Settle post-cancel delay, still waiting for voices.
    await vi.advanceTimersByTimeAsync(80)
    tts.stop()
    // Finish voices timeout path.
    await vi.advanceTimersByTimeAsync(1600)
    await speakPromise
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('stop during speak resolves without error and clears speaking', async () => {
    const tts = createWebTextToSpeechProvider()
    const onEnd = vi.fn()
    const p = tts.speak({
      locale: 'ar',
      text: 'نص قصير',
      interrupt: true,
      onEnd,
    })
    await vi.advanceTimersByTimeAsync(80)
    await Promise.resolve()
    expect(lastUtterance).toBeTruthy()
    tts.stop()
    await p
    expect(tts.isSpeaking()).toBe(false)
  })

  it('arms Chromium resume keepalive while speaking', async () => {
    const tts = createWebTextToSpeechProvider()
    // Long enough that session/provider watchdog stays above the keepalive interval.
    const longText = 'نص طويل بما يكفي لاختبار استئناف الكروم أثناء التشغيل. '.repeat(8)
    const p = tts.speak({
      locale: 'ar',
      text: longText,
      interrupt: true,
    })
    await vi.advanceTimersByTimeAsync(80)
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1)
    await Promise.resolve()
    expect(lastUtterance).toBeTruthy()
    synth.speaking = true
    await vi.advanceTimersByTimeAsync(8_100)
    expect(synth.resume).toHaveBeenCalled()
    lastUtterance?.onend?.(new Event('end'))
    await p
  })
})
