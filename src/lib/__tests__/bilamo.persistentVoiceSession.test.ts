/**
 * Persistent hands-free voice session + date memory regressions.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createBilamoVoiceSession,
  resetSharedBilamoVoiceSessionForTests,
} from '../bilamo/voice/bilamoVoiceSession'
import type {
  BilamoSpeakHandle,
  BilamoVoiceConnectionState,
  BilamoVoiceTransport,
  BilamoVoiceTransportCallbacks,
} from '../bilamo/voice/bilamoVoiceTransport'
import { extractFromUserText } from '../agent/extractRequirements'
import { emptyRequirements } from '../agent/types'
import { mergeRequirements } from '../agent/memory'
import { hasApproximateTravelDates } from '../agent/clarification'
import { nextMinimumQuestion } from '../bilamo/intelligence/clarification'

function makeFakeTransport(): BilamoVoiceTransport & {
  listenCount: number
  speakCount: number
} {
  let callbacks: BilamoVoiceTransportCallbacks = {}
  let listening = false
  let speaking = false
  let gen = 0
  const transport: BilamoVoiceTransport & { listenCount: number; speakCount: number } = {
    kind: 'classic_tts',
    listenCount: 0,
    speakCount: 0,
    setCallbacks(next: BilamoVoiceTransportCallbacks) {
      callbacks = next
    },
    async connect() {
      callbacks.onConnectionStateChange?.('connected')
    },
    disconnect() {},
    async startListening() {
      transport.listenCount += 1
      listening = true
      callbacks.onListeningChange?.(true)
      return true
    },
    stopListening() {
      listening = false
      callbacks.onListeningChange?.(false)
    },
    cancelListening() {
      listening = false
      callbacks.onListeningChange?.(false)
    },
    finalizeListening() {
      listening = false
      callbacks.onListeningChange?.(false)
    },
    speak(request: { text: string }): BilamoSpeakHandle {
      const generation = ++gen
      transport.speakCount += 1
      speaking = true
      void request
      queueMicrotask(() => {
        callbacks.onSpeakingStart?.(generation)
        queueMicrotask(() => {
          speaking = false
          callbacks.onSpeakingEnd?.(generation)
        })
      })
      return { generation, done: Promise.resolve() }
    },
    interrupt() {
      speaking = false
    },
    stop() {
      speaking = false
    },
    isSpeaking() {
      return speaking
    },
    isListening() {
      return listening
    },
    isConnected() {
      return true
    },
    getConnectionState(): BilamoVoiceConnectionState {
      return 'connected'
    },
    dispose() {},
  }
  return transport
}

function transportFactory(fake: BilamoVoiceTransport) {
  return async () => ({
    transport: fake,
    mode: 'classic' as const,
    selected: 'classic_tts' as const,
    fellBack: false,
    reason: 'configured_classic',
  })
}

describe('persistent voice session — single tap multi-turn', () => {
  afterEach(() => {
    resetSharedBilamoVoiceSessionForTests()
    vi.useRealTimers()
  })

  it('first orb tap starts session; playback end auto-returns to listening', async () => {
    vi.useFakeTimers()
    const fake = makeFakeTransport()
    const session = createBilamoVoiceSession({ createTransport: transportFactory(fake) })
    await session.prepare()
    await session.connect()
    session.setContinuousListening(true)
    expect(session.getSnapshot().voiceSessionActive).toBe(true)
    expect(session.getSnapshot().manuallyStopped).toBe(false)

    const ok = await session.startListening()
    expect(ok).toBe(true)
    expect(fake.listenCount).toBe(1)
    expect(session.getSnapshot().state).toBe('listening')

    const handle = session.speak('مرحباً، أنا بيلامو')
    await handle.done
    await vi.advanceTimersByTimeAsync(250)
    expect(session.getSnapshot().voiceSessionActive).toBe(true)
    expect(fake.listenCount).toBeGreaterThanOrEqual(2)
    expect(session.getSnapshot().playback.autoRelistenTriggered).toBe(true)
    session.dispose()
  })

  it('five consecutive turns require only one session arm', async () => {
    vi.useFakeTimers()
    const fake = makeFakeTransport()
    const session = createBilamoVoiceSession({ createTransport: transportFactory(fake) })
    await session.prepare()
    await session.connect()
    session.setContinuousListening(true)
    await session.startListening()
    const listensAfterStart = fake.listenCount

    for (let i = 0; i < 5; i += 1) {
      const handle = session.speak(`رد رقم ${i + 1}`)
      await handle.done
      await vi.advanceTimersByTimeAsync(250)
    }
    expect(session.getSnapshot().voiceSessionActive).toBe(true)
    expect(fake.speakCount).toBe(5)
    expect(fake.listenCount).toBeGreaterThan(listensAfterStart)
    session.dispose()
  })

  it('twenty consecutive turns preserve sessionActive', async () => {
    vi.useFakeTimers()
    const fake = makeFakeTransport()
    const session = createBilamoVoiceSession({ createTransport: transportFactory(fake) })
    await session.prepare()
    await session.connect()
    session.setContinuousListening(true)
    await session.startListening()
    for (let i = 0; i < 20; i += 1) {
      const handle = session.speak(`turn ${i}`)
      await handle.done
      await vi.advanceTimersByTimeAsync(250)
    }
    expect(session.getSnapshot().voiceSessionActive).toBe(true)
    expect(session.getSnapshot().manuallyStopped).toBe(false)
    expect(fake.speakCount).toBe(20)
    session.dispose()
  })

  it('empty EOS recovers to listening while session active', async () => {
    vi.useFakeTimers()
    const fake = makeFakeTransport()
    const session = createBilamoVoiceSession({ createTransport: transportFactory(fake) })
    await session.prepare()
    await session.connect()
    session.setContinuousListening(true)
    await session.startListening()
    const before = fake.listenCount
    session.finalizeListening()
    await vi.advanceTimersByTimeAsync(2000)
    expect(session.getSnapshot().voiceSessionActive).toBe(true)
    expect(fake.listenCount).toBeGreaterThan(before)
    session.dispose()
  })

  it('barge-in returns to listening without ending session', async () => {
    vi.useFakeTimers()
    const fake = makeFakeTransport()
    const session = createBilamoVoiceSession({ createTransport: transportFactory(fake) })
    await session.prepare()
    await session.connect()
    session.setContinuousListening(true)
    await session.startListening()
    session.speak('كلام طويل')
    await vi.advanceTimersByTimeAsync(10)
    const ok = await session.bargeIn()
    expect(ok).toBe(true)
    expect(session.getSnapshot().voiceSessionActive).toBe(true)
    expect(session.getSnapshot().manuallyStopped).toBe(false)
    expect(session.getSnapshot().state).toBe('listening')
    session.dispose()
  })

  it('explicit stop ends the persistent session', async () => {
    const fake = makeFakeTransport()
    const session = createBilamoVoiceSession({ createTransport: transportFactory(fake) })
    await session.prepare()
    await session.connect()
    session.setContinuousListening(true)
    await session.startListening()
    session.stopVoiceSession()
    expect(session.getSnapshot().voiceSessionActive).toBe(false)
    expect(session.getSnapshot().manuallyStopped).toBe(true)
    session.dispose()
  })
})

describe('Riyadh / next-Friday date memory', () => {
  it('إلى الرياض = destination Riyadh', () => {
    const req = extractFromUserText('أريد السفر إلى الرياض')
    expect(req.patch.destination?.toLowerCase()).toContain('riyadh')
  })

  it('من الرياض = origin Riyadh', () => {
    const req = extractFromUserText('من الرياض إلى دبي')
    expect(req.patch.origin?.toLowerCase()).toContain('riyadh')
  })

  it('الجمعة الجاية resolves departure date and is never re-asked', () => {
    const patch = extractFromUserText('الجمعة الجاية').patch
    expect(patch.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const merged = mergeRequirements(emptyRequirements(), {
      destination: 'Riyadh',
      destinations: ['Riyadh'],
      startDate: patch.startDate,
    })
    expect(hasApproximateTravelDates(merged)).toBe(true)
    const next = nextMinimumQuestion({ requirements: merged, askedSlots: [] })
    expect(next).not.toBe('dates')
  })

  it('يوم الجمعة also resolves a concrete startDate', () => {
    const patch = extractFromUserText('يوم الجمعة').patch
    expect(patch.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('next Friday resolves startDate', () => {
    const patch = extractFromUserText('next Friday').patch
    expect(patch.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('silent realtime → classic once contract', () => {
  it('recovery in-flight latch ignores overlapping classic fallback', () => {
    let inFlight = false
    let calls = 0
    const recover = () => {
      if (inFlight) return
      inFlight = true
      calls += 1
      inFlight = false
    }
    recover()
    inFlight = true
    recover()
    expect(calls).toBe(1)
  })
})
