import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Regression: after the first Realtime assistant turn, iPhone users tapped the mic
 * (status=listening → disconnect). disconnect() used to set disposed=true, so the
 * next connect() silently no-op'd until a full page refresh.
 */

describe('realtime session lifecycle contract', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('disconnect allows a later connect on the same session object', async () => {
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

    class FakeRTCPeerConnection {
      connectionState = 'new'
      ontrack: ((e: unknown) => void) | null = null
      private channel = {
        readyState: 'connecting' as string,
        onmessage: null as ((ev: { data: string }) => void) | null,
        onopen: null as (() => void) | null,
        send: vi.fn(),
        close: vi.fn(() => {
          this.channel.readyState = 'closed'
        }),
      }
      createDataChannel() {
        queueMicrotask(() => {
          this.channel.readyState = 'open'
          this.channel.onopen?.()
        })
        return this.channel
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
      mediaDevices: {
        getUserMedia: vi.fn(async () => stream),
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n',
      headers: { get: () => 'application/sdp' },
    })))
    // Minimal DOM for remote audio element
    const body = {
      appendChild: vi.fn(),
    }
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
      body,
    })

    const { createRealtimeWebRtcSession } = await import('../chat/voice/realtimeWebRtcSession')
    const session = createRealtimeWebRtcSession()

    await session.connect()
    expect(session.isConnected()).toBe(true)

    session.disconnect()
    expect(session.isConnected()).toBe(false)
    expect(session.getStatus()).toBe('idle')

    // Critical: reconnect must work without creating a new session object / page refresh.
    await session.connect()
    expect(session.isConnected()).toBe(true)
    expect(session.getStatus()).toBe('listening')

    session.ensureListening()
    expect(session.getStatus()).toBe('listening')

    session.dispose()
    await session.connect()
    expect(session.isConnected()).toBe(false)
  })

  it('hardStop blocks ensureListening until explicit connect', async () => {
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

    class FakeRTCPeerConnection {
      connectionState = 'new'
      ontrack: ((e: unknown) => void) | null = null
      private channel = {
        readyState: 'connecting' as string,
        onmessage: null as ((ev: { data: string }) => void) | null,
        onopen: null as (() => void) | null,
        send: vi.fn(),
        close: vi.fn(() => {
          this.channel.readyState = 'closed'
        }),
      }
      createDataChannel() {
        queueMicrotask(() => {
          this.channel.readyState = 'open'
          this.channel.onopen?.()
        })
        return this.channel
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
      mediaDevices: {
        getUserMedia: vi.fn(async () => stream),
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 201,
      text: async () => 'v=0\r\no=- 1 1 IN IP4 0.0.0.0\r\n',
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
    const session = createRealtimeWebRtcSession()
    await session.connect()
    expect(session.getStatus()).toBe('listening')

    session.hardStop()
    expect(session.isHardStopped()).toBe(true)
    expect(session.isConnected()).toBe(false)
    expect(session.getStatus()).toBe('idle')

    // Pending auto-listen paths must not resurrect the session.
    session.ensureListening()
    expect(session.getStatus()).toBe('idle')
    expect(session.isConnected()).toBe(false)

    // Only an explicit connect (user mic press) may listen again.
    await session.connect()
    expect(session.isHardStopped()).toBe(false)
    expect(session.isConnected()).toBe(true)
    expect(session.getStatus()).toBe('listening')

    session.dispose()
  })
})
