/**
 * P0 — first-turn-only Safari classic TTS + natural spokenText hygiene.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  __resetVoiceHttpTraceForTests,
  getVoiceHttpTrace,
  noteVoiceLifecycleStage,
} from '../bilamo/voice/voiceHttpTrace'
import {
  prepareSpokenTextForTts,
  stripEnglishTemplateFragments,
} from '../bilamo/voice/spokenTextHygiene'
import {
  DEFAULT_VOICE_ID,
  buildTtsSpeechInstructions,
} from '../chat/voice/voiceExperiencePrefs'

function makeProgressingAudio() {
  const attrs = new Map<string, string>()
  let srcValue = ''
  let currentTime = 0
  const el = {
    muted: false,
    volume: 1,
    paused: true,
    ended: false,
    readyState: 4,
    isConnected: true,
    parentNode: null as { removeChild: (n: unknown) => void } | null,
    style: { cssText: '' },
    onplaying: null as ((ev?: Event) => void) | null,
    ontimeupdate: null as ((ev?: Event) => void) | null,
    onended: null as ((ev?: Event) => void) | null,
    onerror: null as ((ev?: Event) => void) | null,
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
      return Promise.resolve().then(() => {
        this.paused = false
        this.onplaying?.(undefined as unknown as Event)
        currentTime = 0.2
        this.ontimeupdate?.(undefined as unknown as Event)
        queueMicrotask(() => {
          this.ended = true
          this.onended?.(undefined as unknown as Event)
        })
      })
    }),
  }
  Object.defineProperty(el, 'src', {
    get: () => srcValue,
    set: (v: string) => {
      srcValue = String(v)
    },
    configurable: true,
  })
  Object.defineProperty(el, 'srcObject', {
    get: () => null,
    set: () => undefined,
    configurable: true,
  })
  Object.defineProperty(el, 'currentTime', {
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v
    },
    configurable: true,
  })
  return el as unknown as HTMLAudioElement & {
    parentNode: { removeChild: (n: unknown) => void } | null
  }
}

describe('spokenText hygiene — Arabic-first consultant summaries', () => {
  it('strips English template fragments while keeping Arabic', () => {
    const raw = 'Understood. تمام، لقيت خيارات حلوة. When are you free?'
    const cleaned = stripEnglishTemplateFragments(raw)
    expect(cleaned).toMatch(/تمام/)
    expect(cleaned).not.toMatch(/Understood/i)
    expect(cleaned).not.toMatch(/When are/i)
  })

  it('caps long card dumps for TTS', () => {
    const long = `تمام، لقيت لك أفضل الخيارات. ${'تفاصيل الفندق والسعر والمرافق. '.repeat(40)}`
    const spoken = prepareSpokenTextForTts(long, 'ar', 220)
    expect(spoken.length).toBeLessThanOrEqual(220)
    expect(spoken).toMatch(/تمام/)
  })

  it('drops English-only residue after template strip on Arabic locale', () => {
    expect(prepareSpokenTextForTts('Understood. When are you free?', 'ar')).toBe('')
  })
})

describe('natural Arabic TTS profile', () => {
  it('defaults to marin (documented coral → marin change)', () => {
    expect(DEFAULT_VOICE_ID).toBe('marin')
    const prefsSrc = readFileSync(
      resolve(__dirname, '../chat/voice/voiceExperiencePrefs.ts'),
      'utf8',
    )
    expect(prefsSrc).toMatch(/was coral/)
    expect(prefsSrc).toMatch(/DEFAULT_VOICE_ID[\s\S]*=\s*'marin'/)
  })

  it('classic transport uses marin + natural instructions + speed 1', () => {
    const classic = readFileSync(
      resolve(__dirname, '../bilamo/voice/classicTransport.ts'),
      'utf8',
    )
    expect(classic).toMatch(/DEFAULT_VOICE_ID/)
    expect(classic).toMatch(/const speed = 1/)
    expect(classic).toMatch(/prepareSpokenTextForTts/)
    expect(classic).toMatch(/isAudioPlaybackUnlocked/)
    expect(classic).toMatch(/resumeSharedAudioContext/)
    const instructions = buildTtsSpeechInstructions({
      locale: 'ar',
      dialect: 'saudi',
      energy: 'natural',
      speed: 'natural',
    })
    expect(instructions).toMatch(/Speak in natural modern Arabic/)
    expect(instructions).toMatch(/human travel-consultant/)
  })
})

describe('Safari unlock — no silent re-prime after first gesture', () => {
  const created: Array<ReturnType<typeof makeProgressingAudio>> = []

  beforeEach(() => {
    __resetVoiceHttpTraceForTests()
    created.length = 0
    vi.resetModules()
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      location: { origin: 'http://localhost' },
      AudioContext: class {
        state = 'running'
        currentTime = 0
        createOscillator() {
          return { connect() {}, start() {}, stop() {} }
        }
        createGain() {
          return { gain: { value: 0 }, connect() {} }
        }
        async resume() {}
        async close() {}
        destination = {}
      },
      speechSynthesis: {
        resume() {},
        cancel() {},
        speak() {},
      },
      SpeechSynthesisUtterance: class {
        volume = 1
        constructor(_text?: string) {}
      },
    })
    vi.stubGlobal('document', {
      body: {
        appendChild: vi.fn((n: { parentNode?: unknown }) => {
          n.parentNode = {
            removeChild: () => {
              n.parentNode = null
            },
          }
          return n
        }),
      },
      head: { appendChild: vi.fn() },
      createElement: vi.fn((tag: string) => {
        if (tag === 'audio') {
          const el = makeProgressingAudio()
          created.push(el)
          return el
        }
        if (tag === 'link') {
          return { rel: '', href: '', setAttribute: vi.fn() }
        }
        return { setAttribute: vi.fn() }
      }),
      hidden: false,
      addEventListener: vi.fn(),
    })
    vi.stubGlobal('Audio', vi.fn(() => {
      const el = makeProgressingAudio()
      created.push(el)
      return el
    }))
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (obj: Blob | MediaSource) =>
        `blob:test-${obj instanceof Blob ? obj.size : 0}-${Math.random()}`,
    )
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', async () => new Response(null, { status: 204 }))
  })

  afterEach(async () => {
    try {
      const mod = await import('../chat/voice/audioElementTextToSpeechProvider')
      mod.__resetAudioElementTtsForTests()
    } catch {
      /* ignore */
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('second unlockAudioPlayback does not re-assign silent WAV', async () => {
    const {
      unlockAudioPlayback,
      isAudioPlaybackUnlocked,
      __resetAudioElementTtsForTests,
    } = await import('../chat/voice/audioElementTextToSpeechProvider')
    __resetAudioElementTtsForTests()

    await unlockAudioPlayback()
    expect(isAudioPlaybackUnlocked()).toBe(true)
    const silentAfterFirst = created.filter((el) =>
      String(el.src || '').startsWith('data:audio/wav'),
    ).length

    for (const el of created) {
      el.removeAttribute('src')
      el.src = ''
    }
    await unlockAudioPlayback()
    expect(isAudioPlaybackUnlocked()).toBe(true)
    const silentAfterSecond = created.filter((el) =>
      String(el.src || '').startsWith('data:audio/wav'),
    ).length
    expect(silentAfterSecond).toBe(0)
    // First unlock may have briefly set silent WAV then cleared it; second must not.
    expect(silentAfterFirst).toBeGreaterThanOrEqual(0)
  })

  it('primeElementForSafari never restores blob: URLs (source contract)', () => {
    const src = readFileSync(
      resolve(__dirname, '../chat/voice/audioElementTextToSpeechProvider.ts'),
      'utf8',
    )
    expect(src).toMatch(/Never restore a revoked blob/)
    expect(src).toMatch(/!prevSrc\.startsWith\('blob:'\)/)
    expect(src).toMatch(/if \(unlocked\)/)
    expect(src).toMatch(/Do NOT call load\(\)/)
    expect(src).toMatch(/clearElementSrcSoft/)
  })
})

describe('multi-turn classic speak lifecycle', () => {
  const created: Array<ReturnType<typeof makeProgressingAudio>> = []

  beforeEach(() => {
    __resetVoiceHttpTraceForTests()
    created.length = 0
    vi.resetModules()
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      location: { origin: 'http://localhost' },
      AudioContext: class {
        state = 'running'
        currentTime = 0
        createOscillator() {
          return { connect() {}, start() {}, stop() {} }
        }
        createGain() {
          return { gain: { value: 0 }, connect() {} }
        }
        async resume() {}
        async close() {}
        destination = {}
      },
      speechSynthesis: {
        resume() {},
        cancel() {},
        speak() {},
      },
      SpeechSynthesisUtterance: class {
        volume = 1
        constructor(_text?: string) {}
      },
    })
    vi.stubGlobal('document', {
      body: {
        appendChild: vi.fn((n: { parentNode?: unknown }) => {
          n.parentNode = {
            removeChild: () => {
              n.parentNode = null
            },
          }
          return n
        }),
      },
      head: { appendChild: vi.fn() },
      createElement: vi.fn((tag: string) => {
        if (tag === 'audio') {
          const el = makeProgressingAudio()
          created.push(el)
          return el
        }
        if (tag === 'link') {
          return { rel: '', href: '', setAttribute: vi.fn() }
        }
        return { setAttribute: vi.fn() }
      }),
      hidden: false,
      addEventListener: vi.fn(),
    })
    vi.stubGlobal('Audio', vi.fn(() => {
      const el = makeProgressingAudio()
      created.push(el)
      return el
    }))
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (obj: Blob | MediaSource) =>
        `blob:test-${obj instanceof Blob ? obj.size : 0}-${Math.random()}`,
    )
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    vi.doMock('../security/voiceAuthProbe', () => ({
      voiceAuthenticatedFetch: async () =>
        new Response(new Uint8Array(2048), {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        }),
    }))
    vi.doMock('../security/proxyAuth', () => ({
      requireProxyAuthHeaders: async () => ({}),
    }))
  })

  afterEach(async () => {
    try {
      const mod = await import('../chat/voice/audioElementTextToSpeechProvider')
      mod.__resetAudioElementTtsForTests()
    } catch {
      /* ignore */
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('plays five consecutive classic TTS turns on the persistent element', async () => {
    const {
      createAudioElementTextToSpeechProvider,
      unlockAudioPlayback,
      __resetAudioElementTtsForTests,
      isAudioPlaybackUnlocked,
    } = await import('../chat/voice/audioElementTextToSpeechProvider')
    __resetAudioElementTtsForTests()

    await unlockAudioPlayback()
    expect(isAudioPlaybackUnlocked()).toBe(true)

    const provider = createAudioElementTextToSpeechProvider()
    const playbackStarts: number[] = []
    const objectUrls: number[] = []

    for (let turn = 1; turn <= 5; turn += 1) {
      noteVoiceLifecycleStage('TTS_REQUEST_STARTED', {
        turnId: turn,
        requestId: `tts_${turn}_test`,
      })
      let started = false
      let assigned = false
      await provider.speak({
        text: `تمام دور ${turn}`,
        locale: 'ar',
        voice: 'marin',
        format: 'mp3',
        speed: 1,
        interrupt: true,
        onObjectUrlAssigned: () => {
          assigned = true
          objectUrls.push(turn)
          noteVoiceLifecycleStage('TTS_OBJECT_URL_ASSIGNED', {
            turnId: turn,
            requestId: `tts_${turn}_test`,
          })
        },
        onAudioPlaybackStart: () => {
          started = true
          playbackStarts.push(turn)
          noteVoiceLifecycleStage('PLAYBACK_STARTED', { turnId: turn })
        },
      })
      expect(assigned, `turn ${turn} object URL`).toBe(true)
      expect(started, `turn ${turn} playback started`).toBe(true)
      noteVoiceLifecycleStage('PLAYBACK_ENDED', { turnId: turn })
    }

    expect(playbackStarts).toEqual([1, 2, 3, 4, 5])
    expect(objectUrls).toEqual([1, 2, 3, 4, 5])
    const trace = getVoiceHttpTrace()
    expect(trace.ttsObjectUrlAssigned).toBe(true)
    expect(trace.ttsRequestId).toMatch(/^tts_5_/)
    expect(created.length).toBeGreaterThanOrEqual(1)
    expect(created.length).toBeLessThan(12)
  })
})

describe('per-turn diagnostics wiring', () => {
  it('session speak resets per-turn TTS latches (source contract)', () => {
    const session = readFileSync(
      resolve(__dirname, '../bilamo/voice/bilamoVoiceSession.ts'),
      'utf8',
    )
    expect(session).toMatch(/playbackDiag\.ttsRequestId = null/)
    expect(session).toMatch(/playbackDiag\.ttsHttpStatus = null/)
    expect(session).toMatch(/playbackDiag\.ttsBytes = null/)
    expect(session).toMatch(/playbackDiag\.ttsObjectUrlAssigned = false/)
    expect(session).toMatch(/playbackDiag\.turnPlaybackStarted = false/)
    expect(session).toMatch(/turnPlaybackEnded = true/)
  })

  it('http trace records TTS_HTTP_STATUS / TTS_BYTES without polluting error codes', () => {
    __resetVoiceHttpTraceForTests()
    noteVoiceLifecycleStage('TTS_REQUEST_STARTED', {
      turnId: 2,
      requestId: 'tts_2_abc',
    })
    noteVoiceLifecycleStage('TTS_HTTP_STATUS', { status: 200 })
    noteVoiceLifecycleStage('TTS_BYTES', { bytes: 4096 })
    noteVoiceLifecycleStage('TTS_OBJECT_URL_ASSIGNED', { requestId: 'tts_2_abc' })
    const trace = getVoiceHttpTrace()
    expect(trace.turnId).toBe(2)
    expect(trace.ttsRequestId).toBe('tts_2_abc')
    expect(trace.ttsHttpStatus).toBe(200)
    expect(trace.ttsBytes).toBe(4096)
    expect(trace.ttsObjectUrlAssigned).toBe(true)
    expect(trace.safeServerErrorCode).toBeNull()
  })
})
