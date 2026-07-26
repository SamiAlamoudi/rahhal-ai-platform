/**
 * Phase 2.6 — Safari STT pipeline: interim-only soft final → onResult,
 * no silent empty deliver, no-result watchdog.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSpeechRecognitionSession,
  resetSpeechRecognitionSingleton,
} from '../useSpeechRecognition'
import {
  clearVoiceTrace,
  getVoiceTraceRecords,
  getVoiceTraceTimeline,
} from '../../lib/chat/voice/voiceDebugTrace'

type HandlerMap = {
  onstart: ((ev: Event) => void) | null
  onresult: ((ev: unknown) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: ((ev: Event) => void) | null
}

type MockRecognition = HandlerMap & {
  lang: string
  continuous: boolean
  started: boolean
  aborted: boolean
  stopped: boolean
}

function createMockCtor(instances: MockRecognition[] = [], opts?: { fireOnStart?: boolean }) {
  const fireOnStart = opts?.fireOnStart !== false
  return class MockSpeechRecognition {
    lang = ''
    continuous = false
    interimResults = false
    maxAlternatives = 1
    onstart: HandlerMap['onstart'] = null
    onresult: HandlerMap['onresult'] = null
    onerror: HandlerMap['onerror'] = null
    onend: HandlerMap['onend'] = null
    started = false
    aborted = false
    stopped = false

    constructor() {
      instances.push(this)
    }

    start() {
      this.started = true
      if (fireOnStart) this.onstart?.(new Event('start'))
    }

    stop() {
      this.stopped = true
      this.onend?.(new Event('end'))
    }

    abort() {
      this.aborted = true
      this.onerror?.({ error: 'aborted' })
      this.onend?.(new Event('end'))
    }
  }
}

function fireResult(
  instance: HandlerMap,
  transcript: string,
  isFinal: boolean,
  resultIndex = 0,
) {
  instance.onresult?.({
    resultIndex,
    results: {
      length: resultIndex + 1,
      [resultIndex]: {
        isFinal,
        0: { transcript },
        length: 1,
      },
    },
  })
}

describe('Phase 2.6 speech recognition STT pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetSpeechRecognitionSingleton()
    clearVoiceTrace()
    vi.stubEnv('VITE_VOICE_TRACE', 'true')
  })

  afterEach(() => {
    resetSpeechRecognitionSingleton()
    clearVoiceTrace()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('soft-finals Safari interim-only onend into onResult (no restart limbo)', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const onResult = vi.fn()
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      silenceMs: 10_000,
      onResult,
    })

    session.start()
    fireResult(instances[0], 'أريد أكادير', false)
    // WebKit ends the non-continuous turn without isFinal.
    instances[0].onend?.(new Event('end'))

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith('أريد أكادير')
    expect(session.getSnapshot().isListening).toBe(false)
    expect(instances).toHaveLength(1)

    const stages = getVoiceTraceRecords().map((r) => r.stage)
    expect(stages).toContain('STT_START')
    expect(stages).toContain('INTERIM_RESULT')
    expect(stages).toContain('FINAL_RESULT')
    session.dispose()
  })

  it('still accumulates isFinal chunks across unexpected browser ends', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const onResult = vi.fn()
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      silenceMs: 10_000,
      onResult,
    })

    session.start()
    fireResult(instances[0], 'Hello', true)
    instances[0].onend?.(new Event('end'))
    expect(onResult).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    fireResult(instances[1], 'world', true)
    session.stop()

    expect(onResult).toHaveBeenCalledWith('Hello world')
    session.dispose()
  })

  it('never silently succeeds on empty final — ERROR with reason', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const onResult = vi.fn()
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      silenceMs: 10_000,
      noResultWatchdogMs: 60_000,
      onResult,
    })

    session.start()
    session.stop()

    expect(onResult).not.toHaveBeenCalled()
    expect(session.getSnapshot().status).toBe('error')
    const fail = getVoiceTraceRecords().find((r) => r.stage === 'FAILURE')
    expect(fail?.reason).toMatch(/final_result_never_arrived|empty_transcript/)
    session.dispose()
  })

  it('STT_START with no results ends via watchdog (not forever listening)', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const onResult = vi.fn()
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      silenceMs: 60_000,
      maxListenMs: 120_000,
      noResultWatchdogMs: 8_000,
      onResult,
    })

    session.start()
    expect(session.getSnapshot().isListening).toBe(true)
    vi.advanceTimersByTime(8_000)
    // stop/onend fallback
    vi.advanceTimersByTime(400)

    expect(onResult).not.toHaveBeenCalled()
    expect(session.getSnapshot().isListening).toBe(false)
    expect(session.getSnapshot().status).toBe('error')
    const fail = getVoiceTraceRecords().find(
      (r) => r.stage === 'FAILURE' && r.reason === 'stt_no_result_watchdog',
    )
    expect(fail).toBeTruthy()
    session.dispose()
  })

  it('timeline includes timestamps for each traced stage', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      silenceMs: 10_000,
      onResult: vi.fn(),
    })

    session.start()
    fireResult(instances[0], 'رحلة', false)
    instances[0].onend?.(new Event('end'))

    const timeline = getVoiceTraceTimeline()
    expect(timeline.length).toBeGreaterThan(0)
    expect(timeline.every((e) => typeof e.at === 'string' && e.at.includes('T'))).toBe(true)
    expect(timeline[0]?.msFromStart).toBe(0)
    session.dispose()
  })
})
