/**
 * P0 diagnostics harness contracts — independent of voice session / mic / realtime.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetDiagnosticAudioHarnessForTests,
  applyCapabilityProbeToHarnessIsNoOp,
  DIRECT_AUDIO_PROBE_TEXT,
  formatAudioTestBanner,
  getDiagnosticAudioHarnessState,
  resetDiagnosticAudioHarness,
  runDirectAudioProbe,
  shouldConfirmAudible,
} from '../bilamo/voice/directAudioProbe'
import {
  __resetVoiceHttpTraceForTests,
  noteVoiceHttpResult,
  noteVoiceRequestDispatched,
} from '../bilamo/voice/voiceHttpTrace'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function makeFakeAudio(opts?: {
  playReject?: Error | null
  progress?: boolean
  resolvePlay?: boolean
}): HTMLAudioElement {
  const playReject = opts?.playReject ?? null
  const progress = opts?.progress ?? false
  const resolvePlay = opts?.resolvePlay ?? true
  let currentTime = 0
  const el = {
    src: '',
    muted: false,
    volume: 1,
    paused: true,
    ended: false,
    readyState: 4,
    onplaying: null as ((ev?: Event) => void) | null,
    ontimeupdate: null as ((ev?: Event) => void) | null,
    onended: null as ((ev?: Event) => void) | null,
    onerror: null as ((ev?: Event) => void) | null,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    load: vi.fn(),
    pause: vi.fn(function (this: { paused: boolean }) {
      this.paused = true
    }),
    play: vi.fn(function (this: typeof el) {
      if (playReject) return Promise.reject(playReject)
      if (!resolvePlay) return new Promise(() => {})
      return Promise.resolve().then(() => {
        this.paused = false
        if (progress) {
          this.onplaying?.(undefined as unknown as Event)
          currentTime = 0.25
          Object.defineProperty(this, 'currentTime', {
            get: () => currentTime,
            configurable: true,
          })
          this.ontimeupdate?.(undefined as unknown as Event)
          this.ended = true
          this.onended?.(undefined as unknown as Event)
        }
      })
    }),
  }
  Object.defineProperty(el, 'currentTime', {
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v
    },
    configurable: true,
  })
  return el as unknown as HTMLAudioElement
}

function okTtsResponse(bytes = 2048): Response {
  const buf = new Uint8Array(bytes)
  return new Response(buf, {
    status: 200,
    headers: { 'content-type': 'audio/wav' },
  })
}

describe('diagnostic audio harness — independence contracts', () => {
  beforeEach(() => {
    __resetDiagnosticAudioHarnessForTests()
    __resetVoiceHttpTraceForTests()
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
  })

  afterEach(() => {
    __resetDiagnosticAudioHarnessForTests()
    __resetVoiceHttpTraceForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts NOT RUN and banner says NOT RUN', () => {
    const state = getDiagnosticAudioHarnessState()
    expect(state.verdict).toBe('NOT_RUN')
    expect(formatAudioTestBanner(state)).toBe('AUDIO TEST: NOT RUN')
  })

  it('runs with voiceSessionActive=false and without microphone / peer', async () => {
    const voiceSessionActive = false
    const micPermission = 'prompt'
    const peer = null
    expect(voiceSessionActive).toBe(false)
    expect(micPermission).toBe('prompt')
    expect(peer).toBeNull()

    const result = await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: true }),
      fetchTts: async () => okTtsResponse(),
      progressTimeoutMs: 20,
    })

    expect(result.verdict).toBe('PASS')
    expect(result.stages[0]).toBe('DIAGNOSTIC_TTS_GESTURE')
    expect(result.stages).toContain('CLASSIC_TTS_REQUESTED')
    expect(result.stages).toContain('PLAY_CALLED')
    expect(result.playCalled).toBe(true)
    expect(result.stages.some((s) => s.startsWith('MIC_'))).toBe(false)
    expect(result.stages.some((s) => s.includes('PEER'))).toBe(false)
  })

  it('classic TTS request fires from the tap (CLASSIC_TTS_REQUESTED)', async () => {
    let fetched = false
    await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: true }),
      fetchTts: async () => {
        fetched = true
        return okTtsResponse()
      },
      progressTimeoutMs: 20,
    })
    expect(fetched).toBe(true)
    expect(getDiagnosticAudioHarnessState().stages).toContain('CLASSIC_TTS_REQUESTED')
  })

  it('play() resolve without progression is NOT success', async () => {
    const result = await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: false, resolvePlay: true }),
      fetchTts: async () => okTtsResponse(),
      progressTimeoutMs: 15,
    })
    expect(result.playResult).toBe('resolved')
    expect(result.verdict).toBe('FAIL')
    expect(result.failureStage).toBe('PLAY_RESOLVED_NO_PROGRESSION')
    expect(formatAudioTestBanner(getDiagnosticAudioHarnessState())).toContain(
      'FAIL — PLAY_RESOLVED_NO_PROGRESSION',
    )
    expect(
      shouldConfirmAudible({
        playResult: 'resolved',
        playingEvent: false,
        maxCurrentTime: 0,
        ended: false,
      }),
    ).toBe(false)
  })

  it('playback progression produces PASS', async () => {
    const result = await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: true }),
      fetchTts: async () => okTtsResponse(),
      progressTimeoutMs: 20,
    })
    expect(result.verdict).toBe('PASS')
    expect(result.result).toBe('AUDIBLE_PIPELINE_CONFIRMED')
    expect(result.stages).toContain('PLAYBACK_PROGRESS')
    expect(result.stages).toContain('ACTUAL_PLAYBACK_STARTED')
    expect(formatAudioTestBanner(getDiagnosticAudioHarnessState())).toBe(
      'AUDIO TEST: PASS — PLAYBACK CONFIRMED',
    )
  })

  it('Safari play rejection produces FAIL with stage + browser error name', async () => {
    const err = new DOMException('The request is not allowed by the user agent', 'NotAllowedError')
    const result = await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ playReject: err }),
      fetchTts: async () => okTtsResponse(),
      progressTimeoutMs: 20,
    })
    expect(result.verdict).toBe('FAIL')
    expect(result.playError).toBe('NotAllowedError')
    expect(result.playErrorMessage).toMatch(/not allowed/i)
    expect(result.failureStage).toBe('PLAY_REJECTED_NotAllowedError')
    expect(result.stages).toContain('PLAY_REJECTED_NotAllowedError')
  })

  it('HTTP TTS failure surfaces safe status stage', async () => {
    const result = await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio(),
      fetchTts: async () =>
        new Response(JSON.stringify({ code: 'AUTH_INVALID' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      progressTimeoutMs: 20,
    })
    expect(result.verdict).toBe('FAIL')
    expect(result.httpStatus).toBe(401)
    expect(result.failureStage).toBe('CLASSIC_TTS_HTTP_401')
    expect(result.stages).toContain('CLASSIC_TTS_HTTP_401')
  })

  it('capability probe cannot overwrite audio-test state', async () => {
    await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: true }),
      fetchTts: async () => okTtsResponse(),
      progressTimeoutMs: 20,
    })
    const before = getDiagnosticAudioHarnessState()
    expect(before.verdict).toBe('PASS')

    noteVoiceRequestDispatched('/api/openai/realtime-session')
    noteVoiceHttpResult({
      route: '/api/openai/realtime-session',
      status: 200,
      kind: 'realtime_capability',
    })

    expect(applyCapabilityProbeToHarnessIsNoOp()).toBe(true)
    const after = getDiagnosticAudioHarnessState()
    expect(after.verdict).toBe('PASS')
    expect(after.stages).toEqual(before.stages)
    expect(after.failureStage).toBeNull()
  })

  it('RESET DIAGNOSTICS clears harness to NOT RUN', async () => {
    await runDirectAudioProbe({
      unlock: async () => undefined,
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: false }),
      fetchTts: async () => okTtsResponse(),
      progressTimeoutMs: 15,
    })
    expect(getDiagnosticAudioHarnessState().verdict).toBe('FAIL')
    resetDiagnosticAudioHarness()
    expect(getDiagnosticAudioHarnessState().verdict).toBe('NOT_RUN')
    expect(getDiagnosticAudioHarnessState().stages).toEqual([])
    expect(formatAudioTestBanner(getDiagnosticAudioHarnessState())).toBe('AUDIO TEST: NOT RUN')
  })

  it('diagnostics page keeps اختبار الصوت ungated and uses harness text', () => {
    const page = readFileSync(resolve(__dirname, '../../pages/BilamoVoiceDiagnostics.tsx'), 'utf8')
    expect(page).toMatch(/اختبار الصوت/)
    expect(page).toMatch(/RESET DIAGNOSTICS/)
    expect(page).toMatch(/formatAudioTestBanner/)
    expect(page).toMatch(/runDirectAudioProbe/)
    expect(page).toMatch(/enabled:\s*false/)
    expect(page).not.toMatch(/disabled=\{probeBusy\}/)
    expect(page).not.toMatch(/disabled=\{harness\.busy\}/)
    expect(DIRECT_AUDIO_PROBE_TEXT).toContain('بيلامو')
    expect(DIRECT_AUDIO_PROBE_TEXT).toContain('تسمعني')
  })
})
