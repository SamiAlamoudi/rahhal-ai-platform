import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createUserTranscriptGate,
  detectTranscriptScript,
  isUnsupportedInterimScript,
  transcriptionLanguageHint,
} from '../chat/voice/userTranscriptGate'
import {
  isHarmlessRealtimeCancelError,
  toUserFacingVoiceError,
  VOICE_RECOVERABLE_ERROR_AR,
} from '../chat/voice/voiceUserFacingError'
import { buildConsultantConversationalInstructions } from '../chat/voice/consultantConversationalStyle'
import { isBenignChatError } from '../chat/chatLogger'

describe('user transcript gate — Arabic speech must not show foreign interim', () => {
  it('detects Arabic vs CJK vs Latin scripts', () => {
    expect(detectTranscriptScript('أريد السفر إلى تايلند لمدة أسبوع')).toBe('arabic')
    expect(detectTranscriptScript('我想去泰国')).toBe('cjk')
    expect(detectTranscriptScript('I want to travel to Thailand')).toBe('latin')
  })

  it('flags Chinese/Korean/Japanese/English interim as unsupported for Arabic turns', () => {
    expect(isUnsupportedInterimScript('我想去泰国一个星期', 'ar')).toBe(true)
    expect(isUnsupportedInterimScript('태국으로 여행하고 싶어요', 'ar')).toBe(true)
    expect(isUnsupportedInterimScript('タイへ旅行したい', 'ar')).toBe(true)
    expect(isUnsupportedInterimScript('I want to travel to Thailand for a week', 'ar')).toBe(true)
    expect(isUnsupportedInterimScript('أريد السفر إلى تايلند لمدة أسبوع', 'ar')).toBe(false)
  })

  it('buffers foreign interim and only displays stable Arabic', () => {
    const gate = createUserTranscriptGate(() => 'ar')
    gate.resetTurn()

    const chinese = gate.ingestDelta('我想')
    expect(chinese.suppressed).toBe(true)
    expect(chinese.displayText).toBeNull()

    const english = gate.ingestDelta('I want to go')
    expect(english.suppressed).toBe(true)

    // Fresh turn with Arabic
    gate.resetTurn()
    gate.ingestDelta('أريد')
    // May suppress until min chars
    const a2 = gate.ingestDelta(' السفر إلى تايلند')
    expect(a2.suppressed).toBe(false)
    expect(a2.displayText).toMatch(/أريد/)
    expect(a2.lockedLanguage).toBe('ar')

    const final = gate.ingestFinal('أريد السفر إلى تايلند لمدة أسبوع')
    expect(final.accepted).toBe(true)
    expect(final.displayText).toBe('أريد السفر إلى تايلند لمدة أسبوع')
    expect(final.lockedLanguage).toBe('ar')
  })

  it('commits exact FINAL ASR once and never substitutes interim', () => {
    const gate = createUserTranscriptGate(() => 'ar')
    gate.resetTurn()
    gate.ingestDelta('أريد')
    gate.ingestDelta(' السفر')
    const finalText = 'أريد السفر إلى تايلند لمدة أسبوع'
    const first = gate.ingestFinal(finalText)
    expect(first.accepted).toBe(true)
    expect(first.exactText).toBe(finalText)
    expect(first.displayText).toBe(finalText)

    // Later "rewrite" must not mutate the locked final
    const second = gate.ingestFinal('I want to go to Thailand for a week')
    expect(second.exactText).toBe(finalText)
    expect(second.displayText).toBe(finalText)
    expect(gate.getCommittedFinal()).toBe(finalText)

    // Interim after final is suppressed
    const delta = gate.ingestDelta(' شيء آخر')
    expect(delta.suppressed).toBe(true)
    expect(delta.displayText).toBeNull()
  })

  it('rejects foreign-script final without falling back to interim (no rewrite)', () => {
    const gate = createUserTranscriptGate(() => 'ar')
    gate.resetTurn()
    gate.lockLanguage('ar')
    gate.ingestDelta('أريد السفر')
    const rejected = gate.ingestFinal('I want to travel to Thailand for a week')
    expect(rejected.accepted).toBe(false)
    expect(rejected.exactText).toBeNull()
    expect(rejected.displayText).toBeNull()
  })

  it('hints Arabic transcription language by default', () => {
    expect(transcriptionLanguageHint(null)).toBe('ar')
    expect(transcriptionLanguageHint('ar')).toBe('ar')
    expect(transcriptionLanguageHint('en')).toBe('en')
  })

  it('locks language for the user turn and does not flip mid-sentence', () => {
    const gate = createUserTranscriptGate(() => 'ar')
    gate.resetTurn()
    gate.ingestDelta('أريد السفر')
    expect(gate.getLockedLanguage()).toBe('ar')
    const bogus = gate.ingestDelta(' Thailand')
    expect(gate.getLockedLanguage()).toBe('ar')
    expect(bogus.lockedLanguage).toBe('ar')
  })
})

describe('voice user-facing errors', () => {
  it('treats cancellation-failed as harmless (never UI)', () => {
    expect(isHarmlessRealtimeCancelError('Cancellation failed: no active response found')).toBe(true)
    expect(toUserFacingVoiceError('Cancellation failed: no active response found')).toBeNull()
    expect(isBenignChatError('Cancellation failed: no active response found')).toBe(true)
  })

  it('maps technical Realtime/WebRTC errors to safe Arabic copy', () => {
    expect(toUserFacingVoiceError('WebRTC SDP negotiation failed')).toBe(VOICE_RECOVERABLE_ERROR_AR)
    expect(toUserFacingVoiceError('OpenAI realtime HTTP 502')).toBe(VOICE_RECOVERABLE_ERROR_AR)
    expect(VOICE_RECOVERABLE_ERROR_AR).toContain('تعذر إكمال المحادثة الصوتية')
  })
})

describe('consultant trip-fact gathering policy', () => {
  it('instructs booking-agent fact gathering before neighborhood essays', () => {
    const instructions = buildConsultantConversationalInstructions({
      language: 'auto',
      utterance: 'أريد السفر إلى تايلند',
      previousLanguage: 'ar',
      languageFallback: 'ar',
    })
    expect(instructions).toMatch(/origin city\/airport/i)
    expect(instructions).toMatch(/ONE follow-up question/i)
    expect(instructions).toMatch(/Sukhumvit|Chaweng|neighborhood/i)
    expect(instructions).toMatch(/BOOKING AGENT/i)
    expect(instructions).toMatch(/never switch mid-reply/i)
    expect(instructions).toMatch(/Do NOT invent live prices|invent live prices/i)
  })
})

describe('realtime cancel-only-when-active lifecycle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  type FakeChannel = {
    readyState: string
    onmessage: ((ev: { data: string }) => void) | null
    onopen: (() => void) | null
    send: ReturnType<typeof vi.fn>
    close: () => void
  }

  async function bootSession(onError?: (m: string) => void) {
    const track = {
      kind: 'audio',
      enabled: true,
      readyState: 'live',
      stop: vi.fn(),
    }
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    }
    const holder: { channel: FakeChannel | null } = { channel: null }

    class FakeRTCPeerConnection {
      ontrack: ((e: unknown) => void) | null = null
      createDataChannel() {
        const ch: FakeChannel = {
          readyState: 'connecting',
          onmessage: null,
          onopen: null,
          send: vi.fn(),
          close: () => {
            ch.readyState = 'closed'
          },
        }
        holder.channel = ch
        queueMicrotask(() => {
          ch.readyState = 'open'
          ch.onopen?.()
        })
        return ch
      }
      addTrack = vi.fn()
      createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'v=0\r\n' }))
      setLocalDescription = vi.fn(async () => undefined)
      setRemoteDescription = vi.fn(async () => undefined)
      getSenders = vi.fn(() => [{ track }])
      close = vi.fn()
    }

    vi.stubGlobal('RTCPeerConnection', FakeRTCPeerConnection)
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => 'v=0\r\n',
      headers: { get: () => 'application/sdp' },
    })))
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        autoplay: false,
        style: {},
        setAttribute: vi.fn(),
        play: vi.fn(async () => undefined),
        pause: vi.fn(),
        remove: vi.fn(),
        currentTime: 0,
        srcObject: null,
      })),
      body: { appendChild: vi.fn() },
    })

    const { createRealtimeWebRtcSession } = await import('../chat/voice/realtimeWebRtcSession')
    const session = createRealtimeWebRtcSession(onError ? { onError } : {})
    await session.connect()
    await new Promise<void>((r) => setTimeout(r, 0))
    if (!holder.channel) throw new Error('expected data channel')
    return { session, channel: holder.channel }
  }

  function cancelCalls(channel: FakeChannel) {
    return channel.send.mock.calls.filter((c) => {
      try {
        const parsed = JSON.parse(String(c[0])) as { type?: string }
        return parsed.type === 'response.cancel'
      } catch {
        return false
      }
    })
  }

  it('does not send response.cancel when no active response (idle interrupt)', async () => {
    const errors: string[] = []
    const { session, channel } = await bootSession((m) => errors.push(m))
    expect(session.getStatus()).toBe('listening')
    channel.send.mockClear()

    session.interrupt()
    expect(cancelCalls(channel)).toHaveLength(0)
    expect(errors).toHaveLength(0)
    session.dispose()
  })

  it('sends response.cancel only after response.created (active response)', async () => {
    const errors: string[] = []
    const { session, channel } = await bootSession((m) => errors.push(m))
    expect(channel.onmessage).toBeTypeOf('function')

    channel.send.mockClear()
    // Authorize speech via sole path (speakWrittenDraft), then create
    session.speakWrittenDraft('ممتاز، خلنا نكمّل الحجز', { locale: 'ar' })
    channel.onmessage!({ data: JSON.stringify({ type: 'response.created', response: { id: 'resp_1' } }) })
    channel.onmessage!({
      data: JSON.stringify({
        type: 'response.output_audio_transcript.delta',
        delta: 'ممتاز، ',
      }),
    })
    expect(session.getStatus()).toBe('speaking')

    session.interrupt()
    expect(cancelCalls(channel).length).toBeGreaterThanOrEqual(1)

    channel.onmessage!({
      data: JSON.stringify({
        type: 'error',
        error: { message: 'Cancellation failed: no active response found' },
      }),
    })
    expect(errors).toHaveLength(0)
    expect(session.getStatus()).not.toBe('error')
    session.dispose()
  })

  it('waits for playback stopped — not response.done alone — before listening', async () => {
    const { session, channel } = await bootSession()

    // Sole Realtime speech path is speakWrittenDraft (planTurn owns words).
    session.speakWrittenDraft('خط كامل من الرد المنطوق', { locale: 'ar' })
    channel.onmessage!({ data: JSON.stringify({ type: 'response.created', response: { id: 'resp_2' } }) })
    channel.onmessage!({ data: JSON.stringify({ type: 'output_audio_buffer.started' }) })
    channel.onmessage!({
      data: JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'خط كامل من الرد المنطوق' }),
    })
    channel.onmessage!({ data: JSON.stringify({ type: 'response.output_audio_transcript.done' }) })
    expect(session.getStatus()).toBe('speaking')

    channel.onmessage!({ data: JSON.stringify({ type: 'response.output_audio.done' }) })
    // Stream done ≠ playback done
    expect(session.getStatus()).toBe('speaking')

    channel.onmessage!({ data: JSON.stringify({ type: 'response.done' }) })
    // Still must NOT listen — wait for output_audio_buffer.stopped
    expect(session.getStatus()).toBe('speaking')

    channel.onmessage!({ data: JSON.stringify({ type: 'output_audio_buffer.stopped' }) })
    expect(session.getStatus()).toBe('listening')
    session.dispose()
  })
})
