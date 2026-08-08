import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  isConfirmedUserUtterance,
  looksLikeAssistantEcho,
} from '../chat/voice/userTranscriptGate'
import { buildRealtimeTurnDetection, buildServerVadFallback } from '../chat/voice/realtimeTurnConfig'

describe('turn management — no unsolicited assistant speech', () => {
  it('disables create_response and interrupt_response (client owns turns + barge-in)', () => {
    expect(buildRealtimeTurnDetection().create_response).toBe(false)
    expect(buildRealtimeTurnDetection().interrupt_response).toBe(false)
    expect(buildServerVadFallback().create_response).toBe(false)
    expect(buildServerVadFallback().interrupt_response).toBe(false)
    expect(buildRealtimeTurnDetection().eagerness).toBe('low')
  })

  it('rejects silence / noise / filler as confirmed utterances', () => {
    expect(isConfirmedUserUtterance('')).toBe(false)
    expect(isConfirmedUserUtterance('   ')).toBe(false)
    expect(isConfirmedUserUtterance('...')).toBe(false)
    expect(isConfirmedUserUtterance('um')).toBe(false)
    expect(isConfirmedUserUtterance('hmm')).toBe(false)
    expect(isConfirmedUserUtterance('إم')).toBe(false)
    expect(isConfirmedUserUtterance('آه')).toBe(false)
  })

  it('accepts real user speech', () => {
    expect(isConfirmedUserUtterance('أريد السفر إلى تايلند')).toBe(true)
    expect(isConfirmedUserUtterance('نعم')).toBe(true)
    expect(isConfirmedUserUtterance('From Riyadh')).toBe(true)
  })

  it('detects assistant self-echo transcripts', () => {
    const assistant = 'تمام، السفر من أي مدينة؟'
    expect(looksLikeAssistantEcho('تمام، السفر من أي مدينة؟', assistant)).toBe(true)
    expect(looksLikeAssistantEcho('السفر من أي مدينة', assistant)).toBe(true)
    expect(looksLikeAssistantEcho('من الرياض يوم الجمعة', assistant)).toBe(false)
  })
})

describe('realtime session — one response per confirmed ASR only', () => {
  beforeEach(async () => {
    vi.resetModules()
    const { __setProxyAccessTokenForTests } = await import('../security/proxyAuth')
    __setProxyAccessTokenForTests('test-user-jwt')
  })

  afterEach(async () => {
    try {
      const { __setProxyAccessTokenForTests } = await import('../security/proxyAuth')
      __setProxyAccessTokenForTests(undefined)
    } catch {
      // ignore
    }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  type FakeChannel = {
    readyState: string
    onmessage: ((ev: { data: string }) => void) | null
    onopen: (() => void) | null
    onclose: (() => void) | null
    onerror: (() => void) | null
    send: ReturnType<typeof vi.fn>
    close: () => void
  }

  async function bootSession(callbacks: {
    onUserTranscript?: (text: string, isFinal: boolean) => void
  } = {}) {
    const track = {
      kind: 'audio',
      enabled: true,
      readyState: 'live',
      muted: false,
      stop: vi.fn(),
      getSettings: () => ({ sampleRate: 48000, channelCount: 1 }),
    }
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
      clone: () => stream,
    }
    const holder: { channel: FakeChannel | null } = { channel: null }

    class FakeRTCPeerConnection {
      connectionState = 'new'
      iceConnectionState = 'new'
      ontrack: ((e: unknown) => void) | null = null
      oniceconnectionstatechange: (() => void) | null = null
      onconnectionstatechange: (() => void) | null = null
      createDataChannel() {
        const ch: FakeChannel = {
          readyState: 'connecting',
          onmessage: null,
          onopen: null,
          onclose: null,
          onerror: null,
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
      setRemoteDescription = vi.fn(async () => {
        this.connectionState = 'connected'
        this.iceConnectionState = 'connected'
      })
      getSenders = vi.fn(() => [{ track, replaceTrack: vi.fn(async () => undefined) }])
      getStats = vi.fn(async () => new Map())
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
    const session = createRealtimeWebRtcSession(callbacks)
    await session.connect()
    await new Promise<void>((r) => setTimeout(r, 0))
    if (!holder.channel) throw new Error('expected channel')
    return { session, channel: holder.channel }
  }

  function sentTypes(channel: FakeChannel) {
    return channel.send.mock.calls.map((c) => {
      try {
        return (JSON.parse(String(c[0])) as { type?: string }).type
      } catch {
        return null
      }
    })
  }

  it('speech_stopped alone does not send response.create', async () => {
    const { session, channel } = await bootSession()
    channel.send.mockClear()
    channel.onmessage!({ data: JSON.stringify({ type: 'input_audio_buffer.speech_started' }) })
    channel.onmessage!({ data: JSON.stringify({ type: 'input_audio_buffer.speech_stopped' }) })
    expect(sentTypes(channel)).not.toContain('response.create')
    expect(session.getStatus()).toBe('listening')
    session.dispose()
  })

  it('noise transcript does not send response.create; confirmed ASR commits after silence debounce', async () => {
    const onUserTranscript = vi.fn()
    const { session, channel } = await bootSession({ onUserTranscript })
    channel.send.mockClear()

    channel.onmessage!({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: '...',
      }),
    })
    expect(sentTypes(channel)).not.toContain('response.create')
    expect(session.getStatus()).toBe('listening')

    channel.send.mockClear()
    channel.onmessage!({ data: JSON.stringify({ type: 'input_audio_buffer.speech_started' }) })
    channel.onmessage!({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'أريد السفر إلى تايلند',
      }),
    })
    channel.onmessage!({ data: JSON.stringify({ type: 'input_audio_buffer.speech_stopped' }) })
    // Not committed until pause debounce completes (interim/segment may be visual-only).
    expect(onUserTranscript.mock.calls.some((c) => c[1] === true)).toBe(false)
    await new Promise((r) => setTimeout(r, 1600))
    // Architecture: Final ASR hands off to the turn owner — Realtime must not invent a reply.
    expect(sentTypes(channel)).not.toContain('response.create')
    expect(onUserTranscript).toHaveBeenCalledWith(
      'أريد السفر إلى تايلند',
      true,
      expect.objectContaining({ committedTranscript: 'أريد السفر إلى تايلند' }),
    )
    session.dispose()
  }, 10_000)

  it('cancels unsolicited response.created when client did not request it', async () => {
    const { session, channel } = await bootSession()
    channel.send.mockClear()
    // Simulate rogue auto-turn (create_response should be off; still guard).
    channel.onmessage!({
      data: JSON.stringify({ type: 'response.created', response: { id: 'rogue_1' } }),
    })
    const types = sentTypes(channel)
    expect(types).toContain('response.cancel')
    expect(session.getStatus()).toBe('listening')
    session.dispose()
  })

  it('after playback stops releases mic to idle and ignores echo of own reply', async () => {
    const { session, channel } = await bootSession()

    // Sole speech path: planTurn → speakWrittenDraft (not ASR → response.create).
    session.speakWrittenDraft('تمام، من أي مدينة؟', { locale: 'ar' })
    channel.onmessage!({
      data: JSON.stringify({ type: 'response.created', response: { id: 'resp_ok' } }),
    })
    channel.onmessage!({ data: JSON.stringify({ type: 'output_audio_buffer.started' }) })
    channel.onmessage!({
      data: JSON.stringify({
        type: 'response.output_audio_transcript.delta',
        delta: 'تمام، من أي مدينة؟',
      }),
    })
    channel.onmessage!({ data: JSON.stringify({ type: 'response.output_audio.done' }) })
    channel.onmessage!({ data: JSON.stringify({ type: 'response.done' }) })
    // Speaking waits for remoteAudio.play() success (Safari audible gate).
    await new Promise<void>((r) => setTimeout(r, 0))
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(session.getStatus()).toBe('speaking')
    channel.onmessage!({ data: JSON.stringify({ type: 'output_audio_buffer.stopped' }) })
    expect(session.getStatus()).toBe('idle')

    channel.send.mockClear()
    // Echo of own words must not create another turn (mic released / not listening)
    channel.onmessage!({
      data: JSON.stringify({
        type: 'conversation.item.input_audio_transcription.completed',
        transcript: 'تمام، من أي مدينة؟',
      }),
    })
    expect(sentTypes(channel)).not.toContain('response.create')
    expect(session.getStatus()).toBe('idle')
    session.dispose()
  })

  it('speakWrittenDraft is the only Realtime response.create path', async () => {
    const { session, channel } = await bootSession()
    channel.send.mockClear()
    session.speakWrittenDraft('هذي الخيارات أمامك. أي رحلة تبغى؟', { locale: 'ar' })
    expect(sentTypes(channel)).toContain('response.create')
    expect(sentTypes(channel)).toContain('conversation.item.create')
    session.dispose()
  })
})
