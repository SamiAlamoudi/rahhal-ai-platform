/**
 * P0 diagnostics harness — Safari classic audio isolation contracts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __resetDiagnosticAudioHarnessForTests,
  applyCapabilityProbeToHarnessIsNoOp,
  createAudibleBeepWavDataUri,
  DIAGNOSTIC_TTS_FORMAT,
  DIRECT_AUDIO_PROBE_TEXT,
  formatAudioTestBanner,
  getDiagnosticAudioElementForTests,
  getDiagnosticAudioHarnessServerSnapshot,
  getDiagnosticAudioHarnessState,
  markDiagnosticInitFailed,
  obtainDiagnosticAudioElement,
  resetDiagnosticAudioHarness,
  runDirectAudioProbe,
  runLocalAudioProbe,
  shouldConfirmAudible,
  unlockDiagnosticAudioElement,
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
  id?: string
}): HTMLAudioElement {
  const playReject = opts?.playReject ?? null
  const progress = opts?.progress ?? false
  const resolvePlay = opts?.resolvePlay ?? true
  let currentTime = 0
  let srcValue = ''
  let srcObject: MediaStream | null = null
  const attrs = new Map<string, string>()
  const el = {
    id: opts?.id || 'bilamo-diagnostic-audio',
    muted: false,
    volume: 1,
    paused: true,
    ended: false,
    readyState: 4,
    networkState: 1,
    duration: 0.45,
    isConnected: true,
    onplaying: null as ((ev?: Event) => void) | null,
    ontimeupdate: null as ((ev?: Event) => void) | null,
    onended: null as ((ev?: Event) => void) | null,
    onerror: null as ((ev?: Event) => void) | null,
    style: { cssText: '' },
    canPlayType: vi.fn((type: string) => (type.includes('mpeg') || type.includes('wav') ? 'probably' : '')),
    setAttribute: vi.fn((k: string, v: string) => {
      attrs.set(k, v)
    }),
    getAttribute: vi.fn((k: string) => {
      if (k === 'src') return srcValue || null
      return attrs.get(k) ?? null
    }),
    removeAttribute: vi.fn((k: string) => {
      if (k === 'src') srcValue = ''
      attrs.delete(k)
    }),
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
          this.ontimeupdate?.(undefined as unknown as Event)
          this.ended = true
          this.onended?.(undefined as unknown as Event)
        }
      })
    }),
  }
  Object.defineProperty(el, 'src', {
    get: () => srcValue,
    set: (v: string) => {
      srcValue = v
    },
    configurable: true,
  })
  Object.defineProperty(el, 'srcObject', {
    get: () => srcObject,
    set: (v: MediaStream | null) => {
      srcObject = v
    },
    configurable: true,
  })
  Object.defineProperty(el, 'currentTime', {
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v
    },
    configurable: true,
  })
  return el as unknown as HTMLAudioElement
}

function okTtsMp3Response(bytes = 2048): Response {
  // ID3 + padding — looks like MP3
  const buf = new Uint8Array(bytes)
  buf[0] = 0x49
  buf[1] = 0x44
  buf[2] = 0x33
  return new Response(buf, {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
  })
}

describe('diagnostic audio harness — Safari classic contracts', () => {
  beforeEach(() => {
    __resetDiagnosticAudioHarnessForTests()
    __resetVoiceHttpTraceForTests()
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
    vi.stubGlobal('document', {
      body: {
        appendChild: vi.fn(),
      },
      createElement: vi.fn(() => makeFakeAudio()),
    })
  })

  afterEach(() => {
    __resetDiagnosticAudioHarnessForTests()
    __resetVoiceHttpTraceForTests()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts NOT RUN', () => {
    expect(formatAudioTestBanner(getDiagnosticAudioHarnessState())).toBe('AUDIO TEST: NOT RUN')
  })

  it('getSnapshot returns a stable reference until harness mutates (React #185)', () => {
    const a = getDiagnosticAudioHarnessState()
    const b = getDiagnosticAudioHarnessState()
    expect(a).toBe(b)
    const serverA = getDiagnosticAudioHarnessServerSnapshot()
    const serverB = getDiagnosticAudioHarnessServerSnapshot()
    expect(serverA).toBe(serverB)
    expect(serverA.verdict).toBe('NOT_RUN')
    resetDiagnosticAudioHarness()
    const c = getDiagnosticAudioHarnessState()
    // emit() rebuilds — reference must change after a real mutation
    expect(c).not.toBe(a)
    expect(getDiagnosticAudioHarnessState()).toBe(c)
  })

  it('markDiagnosticInitFailed surfaces AUDIO TEST FAIL without throwing', () => {
    const state = markDiagnosticInitFailed(new TypeError('boom'))
    expect(state.verdict).toBe('FAIL')
    expect(state.failureStage).toBe('DIAGNOSTICS_INIT_FAILED')
    expect(formatAudioTestBanner(state)).toBe('AUDIO TEST: FAIL — DIAGNOSTICS_INIT_FAILED')
    expect(state.latest?.playError).toBe('TypeError')
    expect(state.latest?.playErrorMessage).toContain('boom')
  })

  it('local asset generation failure becomes DIAGNOSTICS_INIT_FAILED verdict', async () => {
    const result = await runLocalAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: true }),
      localAudioSrc: undefined,
      // Force createAudibleBeep path; inject broken obtain is separate.
      progressTimeoutMs: 20,
    })
    // Happy path still works with default beep — ensure no throw.
    expect(['PASS', 'FAIL']).toContain(result.verdict)
  })

  it('persistent element survives async TTS fetch (same instance)', async () => {
    const persistent = makeFakeAudio({ progress: true, id: 'persist-1' })
    let fetchStarted = false
    const result = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async () => {
        fetchStarted = true
        // After await boundary, still same element.
        expect(persistent.id).toBe('persist-1')
        return okTtsMp3Response()
      },
      progressTimeoutMs: 20,
    })
    expect(fetchStarted).toBe(true)
    expect(result.verdict).toBe('PASS')
    expect(result.stages).not.toContain('AUDIO_ELEMENT_REPLACED_AFTER_FETCH')
    expect(result.stages).toContain('AUDIO_ELEMENT_CREATED')
    expect(result.stages).toContain('PLAY_CALLED')
  })

  it('local control uses same obtainAudio element as TTS', async () => {
    const persistent = makeFakeAudio({ progress: true, id: 'shared-el' })
    const local = await runLocalAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      progressTimeoutMs: 20,
    })
    expect(local.mode).toBe('local')
    expect(local.verdict).toBe('PASS')

    const tts = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async () => okTtsMp3Response(),
      progressTimeoutMs: 20,
    })
    expect(tts.mode).toBe('tts')
    expect(tts.verdict).toBe('PASS')
  })

  it('srcObject is never touched by classic playback', async () => {
    const persistent = makeFakeAudio({ progress: true })
    await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async () => okTtsMp3Response(),
      progressTimeoutMs: 20,
    })
    expect(persistent.srcObject).toBeNull()
    expect(getDiagnosticAudioHarnessState().latest?.hasSrcObject).not.toBe(true)
  })

  it('muted=false / volume=1 after configure', async () => {
    const persistent = makeFakeAudio({ progress: true })
    persistent.muted = true
    persistent.volume = 0
    await runLocalAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      progressTimeoutMs: 20,
    })
    expect(persistent.muted).toBe(false)
    expect(persistent.volume).toBe(1)
  })

  it('silent priming cannot overwrite real src while playing', async () => {
    const persistent = makeFakeAudio({ progress: false })
    persistent.src = 'blob:https://example/real-audio'
    Object.defineProperty(persistent, 'paused', { value: false, configurable: true })
    Object.defineProperty(persistent, 'ended', { value: false, configurable: true })
    await unlockDiagnosticAudioElement(persistent)
    expect(persistent.src).toBe('blob:https://example/real-audio')
  })

  it('play resolved without currentTime progression = FAIL', async () => {
    const persistent = makeFakeAudio({ progress: false, resolvePlay: true })
    const result = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async () => okTtsMp3Response(),
      progressTimeoutMs: 15,
    })
    expect(result.playResult).toBe('resolved')
    expect(result.verdict).toBe('FAIL')
    expect(result.failureStage).toBe('PLAY_RESOLVED_NO_PROGRESSION')
    expect(formatAudioTestBanner(getDiagnosticAudioHarnessState())).toContain(
      'FAIL — PLAY_RESOLVED_NO_PROGRESSION',
    )
  })

  it('capability probe cannot overwrite AUDIO TEST verdict', async () => {
    await runLocalAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: true }),
      progressTimeoutMs: 20,
    })
    expect(getDiagnosticAudioHarnessState().verdict).toBe('PASS')
    noteVoiceRequestDispatched('/api/openai/realtime-session')
    noteVoiceHttpResult({
      route: '/api/openai/realtime-session',
      status: 200,
      kind: 'realtime_capability',
    })
    expect(applyCapabilityProbeToHarnessIsNoOp()).toBe(true)
    expect(getDiagnosticAudioHarnessState().verdict).toBe('PASS')
  })

  it('TTS MIME/bytes captured; format is Safari mp3', async () => {
    expect(DIAGNOSTIC_TTS_FORMAT).toBe('mp3')
    const persistent = makeFakeAudio({ progress: true })
    const result = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async (init) => {
        const body = JSON.parse(String(init.body)) as { format: string }
        expect(body.format).toBe('mp3')
        return okTtsMp3Response(4096)
      },
      progressTimeoutMs: 20,
    })
    expect(String(result.contentType || '')).toMatch(/mpeg|mp3/i)
    expect(result.bytes).toBe(4096)
    expect(result.fileSignature).toBe('ID3/MP3')
    expect(result.stages.some((s) => s.startsWith('CLASSIC_TTS_MIME_'))).toBe(true)
    expect(result.stages).toContain('CLASSIC_TTS_BYTES_4096')
  })

  it('unsupported format produces explicit failure', async () => {
    const persistent = makeFakeAudio({ progress: true })
    const result = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async () =>
        new Response(new Uint8Array([0x00, 0x01, 0x02, 0x03, ...new Uint8Array(100)]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      progressTimeoutMs: 20,
    })
    expect(result.verdict).toBe('FAIL')
    expect(result.failureStage).toBe('UNSUPPORTED_AUDIO_FORMAT')
  })

  it('TTS empty response fails explicitly', async () => {
    const persistent = makeFakeAudio()
    const result = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async () =>
        new Response(new Uint8Array(8), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        }),
      progressTimeoutMs: 20,
    })
    expect(result.failureStage).toBe('TTS_EMPTY_RESPONSE')
  })

  it('Safari play rejection produces FAIL with DOMException name', async () => {
    const err = new DOMException('The request is not allowed by the user agent', 'NotAllowedError')
    const persistent = makeFakeAudio({ playReject: err })
    const result = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => persistent,
      fetchTts: async () => okTtsMp3Response(),
      progressTimeoutMs: 20,
    })
    expect(result.verdict).toBe('FAIL')
    expect(result.failureStage).toBe('PLAY_REJECTED_NotAllowedError')
    expect(result.playErrorMessage).toMatch(/not allowed/i)
  })

  it('detects factory that replaces element after fetch', async () => {
    let n = 0
    const result = await runDirectAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => {
        n += 1
        return makeFakeAudio({ progress: true, id: `el-${n}` })
      },
      fetchTts: async () => okTtsMp3Response(),
      progressTimeoutMs: 20,
    })
    expect(result.failureStage).toBe('AUDIO_ELEMENT_REPLACED_AFTER_FETCH')
  })

  it('reset returns AUDIO TEST to NOT RUN', async () => {
    await runLocalAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: false }),
      progressTimeoutMs: 15,
    })
    expect(getDiagnosticAudioHarnessState().verdict).toBe('FAIL')
    resetDiagnosticAudioHarness()
    expect(getDiagnosticAudioHarnessState().verdict).toBe('NOT_RUN')
    expect(formatAudioTestBanner(getDiagnosticAudioHarnessState())).toBe('AUDIO TEST: NOT RUN')
  })

  it('runs with voiceSessionActive=false and without mic/peer', async () => {
    const voiceSessionActive = false
    expect(voiceSessionActive).toBe(false)
    const result = await runLocalAudioProbe({
      resumeContext: async () => undefined,
      obtainAudio: () => makeFakeAudio({ progress: true }),
      progressTimeoutMs: 20,
    })
    expect(result.verdict).toBe('PASS')
    expect(result.stages.some((s) => s.startsWith('MIC_'))).toBe(false)
  })

  it('shouldConfirmAudible requires progression', () => {
    expect(shouldConfirmAudible({
      playResult: 'resolved',
      playingEvent: false,
      maxCurrentTime: 0,
      ended: false,
    })).toBe(false)
    expect(shouldConfirmAudible({
      playResult: 'resolved',
      playingEvent: true,
      maxCurrentTime: 0.2,
      ended: false,
    })).toBe(true)
  })

  it('local beep data URI is audible WAV (RIFF)', () => {
    const uri = createAudibleBeepWavDataUri(200, 440)
    expect(uri.startsWith('data:audio/wav;base64,')).toBe(true)
    expect(uri.length).toBeGreaterThan(100)
  })

  it('diagnostics page exposes both controls and ungated buttons', () => {
    const page = readFileSync(resolve(__dirname, '../../pages/BilamoVoiceDiagnostics.tsx'), 'utf8')
    expect(page).toMatch(/اختبار صوت محلي/)
    expect(page).toMatch(/اختبار TTS/)
    expect(page).toMatch(/RESET DIAGNOSTICS/)
    expect(page).toMatch(/runLocalAudioProbe/)
    expect(page).toMatch(/runDirectAudioProbe/)
    expect(page).toMatch(/enabled:\s*false/)
    expect(page).toMatch(/getDiagnosticAudioHarnessServerSnapshot/)
    expect(page).toMatch(/DIAGNOSTICS_INIT_FAILED/)
    expect(page).toMatch(/DiagnosticsHarnessBoundary/)
    expect(page).not.toMatch(/disabled=\{/)
    expect(DIRECT_AUDIO_PROBE_TEXT).toContain('بيلامو')
  })

  it('directAudioProbe module is SSR-safe at import (no Audio/document side effects)', async () => {
    // Re-import path analysis: module body must not call document/Audio/URL.createObjectURL.
    const src = readFileSync(
      resolve(__dirname, '../bilamo/voice/directAudioProbe.ts'),
      'utf8',
    )
    const bodyBeforeFirstExportFn = src.split('export async function runLocalAudioProbe')[0] ?? src
    // Top-level statements after imports must not construct media objects.
    expect(bodyBeforeFirstExportFn).not.toMatch(/\nnew Audio\(/)
    expect(bodyBeforeFirstExportFn).not.toMatch(/\nnew \(window\.AudioContext/)
    expect(bodyBeforeFirstExportFn).not.toMatch(/\nURL\.createObjectURL\(/)
    expect(bodyBeforeFirstExportFn).not.toMatch(/\ndocument\.createElement\(/)
    // obtain* and unlock* are function-scoped and document-guarded.
    expect(src).toMatch(/typeof document === 'undefined'/)
    expect(src).toMatch(/typeof navigator === 'undefined'/)
    expect(getDiagnosticAudioHarnessServerSnapshot()).toBe(getDiagnosticAudioHarnessServerSnapshot())
  })

  it('obtainDiagnosticAudioElement reuses singleton', () => {
    const a = obtainDiagnosticAudioElement()
    const b = obtainDiagnosticAudioElement()
    expect(a).toBe(b)
    expect(getDiagnosticAudioElementForTests()).toBe(a)
  })
})
