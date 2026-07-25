/**
 * Integration Sprint 1 — OpenAI Realtime provider tests.
 * Uses injectable fetch + fake WebSocket (no live network / no secrets).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_OPENAI_REALTIME_VERSION,
  buildTravelConsultantInstructions,
  connectWithFailover,
  createOpenAIRealtimeProvider,
  createVoiceSession,
  isOpenAiRealtimeClientEnabled,
  isRealtimeVoiceEnabled,
  mapToolNameToDecision,
} from '../realtimeVoice'
import type { RealtimeSocket } from '../realtimeVoice/providers/openaiRealtimeProtocol'
import { WS_OPEN } from '../realtimeVoice/providers/openaiRealtimeProtocol'
import { resetAgentRuntimeSessions } from '../agent/agentRuntime'

class FakeSocket implements RealtimeSocket {
  readyState = WS_OPEN
  sent: string[] = []
  private listeners = new Map<string, Array<(ev: { data?: string }) => void>>()

  addEventListener(type: string, listener: (ev: { data?: string }) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = 3
    for (const fn of this.listeners.get('close') ?? []) fn({})
  }

  emit(type: string, data?: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn({ data })
  }
}

describe('Integration Sprint 1 — OpenAI Realtime', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetAgentRuntimeSessions()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetAgentRuntimeSessions()
    vi.unstubAllEnvs()
  })

  it('keeps feature flag OFF and client realtime disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.realtime_voice')).toBe(false)
    expect(isRealtimeVoiceEnabled()).toBe(false)
    expect(isOpenAiRealtimeClientEnabled()).toBe(false)
    expect(INTEGRATION_OPENAI_REALTIME_VERSION).toMatch(/openai-realtime/)
  })

  it('consultant prompt covers Arabic dialects and anti-interview guidance', () => {
    const ar = buildTravelConsultantInstructions('ar')
    expect(ar).toMatch(/سعود/)
    expect(ar).toMatch(/يمني/)
    expect(ar).toMatch(/مقابلة/)
    const en = buildTravelConsultantInstructions('en')
    expect(en).toMatch(/Saudi|Gulf|Yemeni/i)
    expect(en).toMatch(/interview/i)
  })

  it('maps travel tools to mock Agent Runtime decisions', () => {
    expect(mapToolNameToDecision('search_flights')).toBe('search_flights')
    expect(mapToolNameToDecision('visa_info')).toBe('need_visa')
    expect(mapToolNameToDecision('weather')).toBe('need_weather')
    expect(mapToolNameToDecision('plan_trip')).toBe('need_itinerary')
  })

  it('is unavailable without live allow + client enable', () => {
    const provider = createOpenAIRealtimeProvider()
    expect(provider.isAvailable()).toBe(false)
  })

  it('failovers to mock when openai connect cannot mint session', async () => {
    vi.stubEnv('VITE_VOICE_LIVE_ALLOW', 'true')
    vi.stubEnv('VITE_OPENAI_REALTIME_ENABLED', 'true')
    const { provider, connection } = await connectWithFailover({
      conversationId: 'oa-fo',
      preferred: 'openai_realtime',
      locale: 'ar',
      allowLive: true,
    })
    // Default fetch to /api will 404/fail in vitest → failover mock
    expect(connection.connected).toBe(true)
    expect(provider.providerId).toBe('mock')
    expect(connection.failoverFrom).toBe('openai_realtime')
  })

  it('connects with ephemeral session + fake socket (streaming + interrupt)', async () => {
    vi.stubEnv('VITE_VOICE_LIVE_ALLOW', 'true')
    vi.stubEnv('VITE_OPENAI_REALTIME_ENABLED', 'true')

    const fake = new FakeSocket()
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({
        client_secret: 'ek_test_secret',
        expires_at: Math.floor(Date.now() / 1000) + 600,
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
        locale: 'ar',
        ws_url: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      }), { status: 200 }),
    )

    const provider = createOpenAIRealtimeProvider({
      fetchFn: fetchFn as unknown as typeof fetch,
      createSocket: () => fake,
    })

    expect(provider.isAvailable()).toBe(true)
    const info = await provider.connect({ conversationId: 'oa-live', locale: 'ar', allowLive: true })
    expect(info.connected).toBe(true)
    expect(info.live).toBe(true)
    expect(fetchFn).toHaveBeenCalled()
    expect(fake.sent.some((s) => s.includes('session.update'))).toBe(true)

    const partials: string[] = []
    const finals: string[] = []
    provider.setHandlers({
      onPartialTranscript: (p) => partials.push(p.text),
      onFinalTranscript: (t) => finals.push(t),
      onAssistantPartial: (t) => partials.push(t),
      onAssistantFinal: (t) => finals.push(t),
    })

    fake.emit('message', JSON.stringify({
      type: 'conversation.item.input_audio_transcription.delta',
      delta: 'أبي',
    }))
    fake.emit('message', JSON.stringify({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'أبي اليابان',
    }))
    fake.emit('message', JSON.stringify({
      type: 'response.audio_transcript.delta',
      delta: 'تمام، خلنا نخطط لليابان',
    }))
    fake.emit('message', JSON.stringify({
      type: 'response.audio_transcript.done',
      transcript: 'تمام، خلنا نخطط لليابان',
    }))

    expect(partials.join(' ')).toMatch(/أبي/)
    expect(finals.join(' ')).toMatch(/اليابان|نخطط/)

    await provider.interrupt()
    expect(fake.sent.some((s) => s.includes('response.cancel'))).toBe(true)

    const pcm = new Uint8Array([1, 2, 3, 4]).buffer
    await provider.pushAudio(pcm)
    expect(fake.sent.some((s) => s.includes('input_audio_buffer.append'))).toBe(true)

    expect(provider.latencySamples.voiceStartMs.length).toBeGreaterThan(0)

    await provider.disconnect()
    expect(provider.getState()).toBe('idle')
  })

  it('executes mock tool call over the realtime socket', async () => {
    vi.stubEnv('VITE_VOICE_LIVE_ALLOW', 'true')
    vi.stubEnv('VITE_OPENAI_REALTIME_ENABLED', 'true')
    const fake = new FakeSocket()
    const provider = createOpenAIRealtimeProvider({
      fetchFn: (async () =>
        new Response(JSON.stringify({
          client_secret: 'ek_tool',
          expires_at: null,
          model: 'gpt-4o-realtime-preview',
          voice: 'alloy',
          locale: 'en',
          ws_url: 'wss://example.test/realtime',
        }), { status: 200 })) as unknown as typeof fetch,
      createSocket: () => fake,
    })
    await provider.connect({ conversationId: 'oa-tool', locale: 'en', allowLive: true })
    fake.emit('message', JSON.stringify({
      type: 'response.function_call_arguments.done',
      call_id: 'call_1',
      name: 'search_flights',
      arguments: JSON.stringify({ destination: 'Tokyo', origin: 'RUH' }),
    }))
    // allow microtask for async tool handler
    await new Promise((r) => setTimeout(r, 10))
    expect(fake.sent.some((s) => s.includes('function_call_output'))).toBe(true)
    expect(fake.sent.some((s) => s.includes('response.create'))).toBe(true)
    await provider.disconnect()
  })

  it('Saudi dialect travel dialogue still works on mock session path', async () => {
    const session = createVoiceSession({
      conversationId: 'oa-dialect',
      locale: 'ar',
      preferredProvider: 'mock',
    })
    await session.start()
    await session.pushTranscript('أبي اليابان خلها أكتوبر', true)
    expect(session.getRealtime().getMemory()?.destination).toBe('Japan')
    expect(session.getRealtime().getMemory()?.monthHint).toBe('October')
    await session.stop()
  })

  it('mints credentials only via same-origin /api session endpoint', async () => {
    vi.stubEnv('VITE_VOICE_LIVE_ALLOW', 'true')
    vi.stubEnv('VITE_OPENAI_REALTIME_ENABLED', 'true')
    const urls: string[] = []
    const provider = createOpenAIRealtimeProvider({
      fetchFn: (async (input: RequestInfo | URL) => {
        urls.push(String(input))
        return new Response(JSON.stringify({ error: 'no', code: 'OPENAI_REALTIME_SERVER_NOT_CONFIGURED' }), {
          status: 503,
        })
      }) as unknown as typeof fetch,
    })
    const info = await provider.connect({ conversationId: 'sec', allowLive: true })
    expect(info.connected).toBe(false)
    expect(urls.some((u) => u.includes('/api/openai-realtime-session'))).toBe(true)
    expect(urls.every((u) => !u.includes('api.openai.com'))).toBe(true)
  })
})
