import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSpeechRecognitionSession,
  detectSpeechLang,
  isSpeechRecognitionSupported,
  resetSpeechRecognitionSingleton,
} from '../../hooks/useSpeechRecognition'

type HandlerMap = {
  onstart: ((ev: Event) => void) | null
  onresult: ((ev: unknown) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: ((ev: Event) => void) | null
}

type MockRecognition = HandlerMap & {
  lang: string
  started: boolean
  aborted: boolean
  stopped: boolean
}

function createMockCtor(instances: MockRecognition[] = []) {
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
      this.onstart?.(new Event('start'))
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

describe('detectSpeechLang', () => {
  it('maps Arabic browser languages to ar-SA', () => {
    expect(detectSpeechLang('ar')).toBe('ar-SA')
    expect(detectSpeechLang('ar-SA')).toBe('ar-SA')
    expect(detectSpeechLang('ar-EG')).toBe('ar-SA')
    expect(detectSpeechLang('AR-sa')).toBe('ar-SA')
  })

  it('maps other languages to en-US', () => {
    expect(detectSpeechLang('en')).toBe('en-US')
    expect(detectSpeechLang('en-US')).toBe('en-US')
    expect(detectSpeechLang('en-GB')).toBe('en-US')
    expect(detectSpeechLang('fr-FR')).toBe('en-US')
  })
})

describe('createSpeechRecognitionSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetSpeechRecognitionSingleton()
  })

  afterEach(() => {
    resetSpeechRecognitionSingleton()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reports unsupported when SpeechRecognition is missing', () => {
    const session = createSpeechRecognitionSession({
      getCtor: () => null,
    })
    expect(session.getSnapshot().status).toBe('unsupported')
    expect(session.getSnapshot().error).toBe('unsupported')
    expect(isSpeechRecognitionSupported()).toBe(false)
    session.dispose()
  })

  it('toggles listening on and off', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      detectLang: () => 'en-US',
    })

    session.toggle()
    expect(session.getSnapshot().isListening).toBe(true)
    expect(session.getSnapshot().status).toBe('listening')
    expect(instances).toHaveLength(1)

    session.toggle()
    expect(session.getSnapshot().isListening).toBe(false)
    expect(session.getSnapshot().status).toBe('idle')
    session.dispose()
  })

  it('auto-detects ar-SA and inserts final transcript via onResult (never auto-send)', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const onResult = vi.fn()
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      detectLang: () => 'ar-SA',
      onResult,
    })

    session.start()
    expect(session.getSnapshot().lang).toBe('ar-SA')
    expect(instances[0]?.lang).toBe('ar-SA')

    fireResult(instances[0], 'أريد السفر إلى دبي', true)
    instances[0].onend?.(new Event('end'))

    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith('أريد السفر إلى دبي')
    expect(session.getSnapshot().status).toBe('idle')
    session.dispose()
  })

  it('auto-stops after silence', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const onResult = vi.fn()
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      silenceMs: 1000,
      onResult,
    })

    session.start()
    fireResult(instances[0], 'Tokyo trip', false)
    vi.advanceTimersByTime(1000)

    expect(instances[0].stopped).toBe(true)
    expect(onResult).toHaveBeenCalledWith('Tokyo trip')
    session.dispose()
  })

  it('handles permission denied', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
    })

    session.start()
    instances[0].onerror?.({ error: 'not-allowed' })
    expect(session.getSnapshot().status).toBe('permission-denied')
    expect(session.getSnapshot().error).toBe('permission-denied')
    session.dispose()
  })

  it('handles no-speech', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
    })

    session.start()
    instances[0].onerror?.({ error: 'no-speech' })
    expect(session.getSnapshot().error).toBe('no-speech')
    expect(session.getSnapshot().status).toBe('error')
    session.dispose()
  })

  it('handles timeout via max listen timer', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      maxListenMs: 5000,
      silenceMs: 60_000,
    })

    session.start()
    vi.advanceTimersByTime(5000)
    expect(session.getSnapshot().error).toBe('timeout')
    session.dispose()
  })

  it('handles recognition failure', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
    })

    session.start()
    instances[0].onerror?.({ error: 'network' })
    expect(session.getSnapshot().error).toBe('recognition-failure')
    session.dispose()
  })

  it('handles user cancellation without delivering transcript', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const onResult = vi.fn()
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
      onResult,
    })

    session.start()
    fireResult(instances[0], 'should not send', true)
    session.cancel()
    expect(onResult).not.toHaveBeenCalled()
    expect(session.getSnapshot().error).toBe('user-cancelled')
    expect(session.getSnapshot().status).toBe('idle')
    session.dispose()
  })

  it('prevents duplicate recognizers across sessions', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const a = createSpeechRecognitionSession({ getCtor: () => Ctor as never })
    const b = createSpeechRecognitionSession({ getCtor: () => Ctor as never })

    a.start()
    expect(instances).toHaveLength(1)
    b.start()
    expect(instances).toHaveLength(2)
    expect(instances[0].aborted).toBe(true)
    expect(b.getSnapshot().isListening).toBe(true)

    a.dispose()
    b.dispose()
  })

  it('cleans up recognition on dispose (unmount / route change)', () => {
    const instances: MockRecognition[] = []
    const Ctor = createMockCtor(instances)
    const session = createSpeechRecognitionSession({
      getCtor: () => Ctor as never,
    })

    session.start()
    expect(session.getSnapshot().isListening).toBe(true)
    session.dispose()
    expect(instances[0].aborted).toBe(true)
    // Further start is a no-op after dispose.
    session.start()
    expect(instances).toHaveLength(1)
  })
})
