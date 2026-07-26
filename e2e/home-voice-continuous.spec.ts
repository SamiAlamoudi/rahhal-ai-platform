import { expect, test, type Page } from '@playwright/test'

/**
 * Recovery Phase 2.4 — prove home mic auto-submits into continuous /chat voice.
 * Prefer VOICE_E2E_BASE_URL (Vercel Preview). Local preview works via playwright.config webServer.
 */

const TURN1 =
  'أريد السفر إلى المغرب لمدة أسبوع مع زوجتي وميزانيتي عشرة آلاف ريال'
const TURN2 = 'أفضل أكادير والرحلة من الرياض'

const BYPASS = process.env.VERCEL_PROTECTION_BYPASS ?? ''

async function installVoiceMocks(page: Page, transcripts: string[]) {
  await page.addInitScript((queue) => {
    const pending = [...queue]
    const spoken: string[] = []
    const events: string[] = []
    ;(window as unknown as { __ttsSpoken: string[]; __ttsEvents: string[] }).__ttsSpoken = spoken
    ;(window as unknown as { __ttsSpoken: string[]; __ttsEvents: string[] }).__ttsEvents = events

    // Fake mic stream so permission + VAD do not fail headless Chrome.
    const fakeTrack = {
      stop() {},
      kind: 'audio',
      enabled: true,
      readyState: 'live',
    }
    const fakeStream = {
      getTracks: () => [fakeTrack],
      getAudioTracks: () => [fakeTrack],
    }
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => fakeStream as unknown as MediaStream
    } else {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => fakeStream as unknown as MediaStream },
      })
    }

    class MockSpeechRecognition {
      continuous = false
      interimResults = true
      lang = 'ar-SA'
      onstart: ((ev: Event) => void) | null = null
      onresult: ((ev: unknown) => void) | null = null
      onerror: ((ev: unknown) => void) | null = null
      onend: (() => void) | null = null
      private timer: number | null = null
      start() {
        this.onstart?.(new Event('start'))
        const transcript = pending.shift() ?? ''
        this.timer = window.setTimeout(() => {
          if (transcript) {
            const result = {
              0: { transcript, confidence: 0.93 },
              isFinal: true,
              length: 1,
            }
            const event = {
              resultIndex: 0,
              results: {
                0: result,
                length: 1,
                item: (i: number) => (i === 0 ? result : null),
              },
            }
            this.onresult?.(event)
          }
          this.onend?.()
        }, 700)
      }
      stop() {
        if (this.timer) window.clearTimeout(this.timer)
        this.onend?.()
      }
      abort() {
        if (this.timer) window.clearTimeout(this.timer)
        this.onend?.()
      }
    }
    ;(window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = MockSpeechRecognition
    ;(window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition =
      MockSpeechRecognition

    const arabicVoice = {
      name: 'Arabic',
      lang: 'ar-SA',
      localService: true,
      default: true,
      voiceURI: 'ar-SA',
    } as SpeechSynthesisVoice

    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => [arabicVoice],
      speak(u: SpeechSynthesisUtterance) {
        spoken.push(u.text)
        events.push('speak')
        synth.speaking = true
        synth.pending = false
        queueMicrotask(() => {
          u.onstart?.(new Event('start') as SpeechSynthesisEvent)
          events.push('onstart')
          window.setTimeout(() => {
            synth.speaking = false
            u.onend?.(new Event('end') as SpeechSynthesisEvent)
            events.push('onend')
          }, 350)
        })
      },
      cancel() {
        synth.speaking = false
        synth.pending = false
        events.push('cancel')
      },
      pause() {},
      resume() {},
      addEventListener(type: string, listener: EventListener) {
        if (type === 'voiceschanged') {
          queueMicrotask(() => listener(new Event('voiceschanged')))
        }
      },
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
      onvoiceschanged: null as ((this: SpeechSynthesis, ev: Event) => void) | null,
    }

    try {
      delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis
    } catch {
      /* ignore */
    }
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: synth,
    })
  }, transcripts)
}

test.describe('Phase 2.4 home voice continuous', () => {
  test('mic auto-submits without ابدأ المحادثة; turn 2 continues; stop ends session', async ({
    page,
    context,
  }) => {
    const base = test.info().project.use.baseURL ?? ''
    const isRemote = /^https?:\/\/(?!127\.0\.0\.1|localhost)/.test(base)
    test.skip(isRemote && !BYPASS, 'VERCEL_PROTECTION_BYPASS required for Preview SSO protection')

    await context.grantPermissions(['microphone']).catch(() => {})
    await installVoiceMocks(page, [TURN1, TURN2])

    const loginPath = BYPASS
      ? `/login?x-vercel-protection-bypass=${BYPASS}&x-vercel-set-bypass-cookie=true`
      : '/login'
    await page.goto(loginPath)
    await expect(page.getByRole('heading', { name: 'رحّال' })).toBeVisible({ timeout: 30_000 })

    const demo = page.getByTestId('login-demo')
    await expect(demo).toBeVisible({ timeout: 15_000 })
    await demo.click()

    await expect(page).toHaveURL(/\/(\?.*)?$/)
    await expect(page.getByTestId('ai-home-composer')).toBeVisible({ timeout: 30_000 })

    // One mic tap — do NOT click ابدأ المحادثة.
    await page.getByTestId('ai-home-voice').click()
    await expect(page.getByTestId('ai-home-voice-status')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('ai-home-send')).toHaveCount(0)

    // Auto-submit navigates to /chat without second CTA.
    await expect(page).toHaveURL(/\/chat/, { timeout: 45_000 })
    await expect(page.getByText(/المغرب|ميزاني/)).toBeVisible({ timeout: 45_000 })

    // No stale Riyadh→Dubai demo cards for a Morocco trip.
    await expect(page.getByText('الرياض → دبي')).toHaveCount(0)

    const voiceTab = page.getByRole('tab', { name: 'صوت' })
    if (await voiceTab.count()) {
      await voiceTab.click()
    }

    await expect(
      page.locator('text=/\\؟|مدينة|مغادرة|مدة|ميزانية|أكادير|مراكش|الوجهة|شاطئ/').first(),
    ).toBeVisible({ timeout: 60_000 })

    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as unknown as { __ttsSpoken?: string[] }).__ttsSpoken?.length ?? 0),
        { timeout: 45_000 },
      )
      .toBeGreaterThan(0)

    // Turn 2 without touching mic / send.
    await expect(page.getByText(TURN2).or(page.getByText(/أكادير/))).toBeVisible({
      timeout: 90_000,
    })

    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as unknown as { __ttsSpoken?: string[] }).__ttsSpoken?.length ?? 0),
        { timeout: 60_000 },
      )
      .toBeGreaterThanOrEqual(2)

    const stopBtn = page.getByTestId('voice-session-primary')
    await expect(stopBtn).toBeVisible({ timeout: 15_000 })
    await stopBtn.click()

    const ttsEvents = await page.evaluate(
      () => (window as unknown as { __ttsEvents?: string[] }).__ttsEvents ?? [],
    )
    expect(ttsEvents).toContain('onstart')
    expect(ttsEvents).toContain('onend')

    await expect(page).toHaveURL(/\/chat/)
    await expect(page.getByTestId('ai-home-send')).toHaveCount(0)
  })
})
