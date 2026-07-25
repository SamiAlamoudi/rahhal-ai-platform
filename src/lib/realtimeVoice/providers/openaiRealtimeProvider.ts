/**
 * Integration Sprint 1 — OpenAI Realtime provider (production wiring).
 *
 * - Ephemeral credentials from POST /api/openai-realtime-session (server OPENAI_API_KEY)
 * - Never requires VITE_* production secrets for connect
 * - Live sockets only when VITE_VOICE_LIVE_ALLOW=true
 * - Tool calls execute via Agent Runtime mock adapters
 * - Failures report connected:false so factory failovers to mock
 */

import { ExecutionEvents } from '../../agent/agentRuntime/executionEvents'
import { executeRuntimeTool } from '../../agent/agentRuntime/tools/toolExecutor'
import { createEmptyLiveTravelMemory } from '../../agent/conversationIntelligence'
import { isVoiceLiveNetworkAllowed } from '../feature'
import { BaseVoiceProvider } from './baseProvider'
import {
  arrayBufferToBase64,
  buildSessionUpdateEvent,
  mapToolNameToDecision,
  parseRealtimeEvent,
  WS_OPEN,
  type OpenAiRealtimeSessionCredentials,
  type RealtimeSocket,
} from './openaiRealtimeProtocol'
import type { VoiceConnectionInfo, VoiceProviderCapabilities, VoiceProviderConnectOptions } from '../types'

export type OpenAiRealtimeProviderDeps = {
  fetchFn?: typeof fetch
  /** Injected WebSocket factory for unit tests (no real network). */
  createSocket?: (url: string, protocols: string[]) => RealtimeSocket
  sessionPath?: string
}

function envFlag(name: string): boolean {
  try {
    const value = (import.meta.env as Record<string, unknown>)[name]
    return value === true || value === 'true'
  } catch {
    return false
  }
}

function envProviderHint(): string | null {
  try {
    return (import.meta.env.VITE_REALTIME_VOICE_PROVIDER as string | undefined)?.trim().toLowerCase() ?? null
  } catch {
    return null
  }
}

/** Non-secret client opt-in to attempt OpenAI Realtime when live allow is set. */
export function isOpenAiRealtimeClientEnabled(): boolean {
  if (envFlag('VITE_OPENAI_REALTIME_ENABLED')) return true
  if (envProviderHint() === 'openai_realtime') return true
  return false
}

function defaultCreateSocket(url: string, protocols: string[]): RealtimeSocket {
  const WS = (globalThis as { WebSocket?: new (u: string, p?: string | string[]) => RealtimeSocket }).WebSocket
  if (!WS) {
    throw new Error('WebSocket_unavailable')
  }
  return new WS(url, protocols)
}

export class OpenAIRealtimeProvider extends BaseVoiceProvider {
  readonly providerId = 'openai_realtime' as const
  readonly displayName = 'OpenAI Realtime API'
  readonly isLive = true
  readonly capabilities: VoiceProviderCapabilities = {
    duplex: true,
    streamingStt: true,
    streamingTts: true,
    bargeIn: true,
  }

  private readonly deps: Required<OpenAiRealtimeProviderDeps>
  private socket: RealtimeSocket | null = null
  private credentials: OpenAiRealtimeSessionCredentials | null = null
  private assistantAcc = ''
  private connectStartedAt = 0
  private firstAudioAt = 0
  /** Latency samples for sprint metrics (ms). */
  readonly latencySamples = {
    voiceStartMs: [] as number[],
    roundTripMs: [] as number[],
    reconnectMs: [] as number[],
  }
  private pendingToolArgs = new Map<string, { name: string; args: string; callId: string }>()

  constructor(deps: OpenAiRealtimeProviderDeps = {}) {
    super()
    this.deps = {
      fetchFn: deps.fetchFn ?? fetch.bind(globalThis),
      createSocket: deps.createSocket ?? defaultCreateSocket,
      sessionPath: deps.sessionPath ?? '/api/openai-realtime-session',
    }
  }

  isAvailable(): boolean {
    // No frontend API key required — server mints ephemeral secrets.
    return isVoiceLiveNetworkAllowed() && isOpenAiRealtimeClientEnabled()
  }

  override async connect(options: VoiceProviderConnectOptions): Promise<VoiceConnectionInfo> {
    this.conversationId = options.conversationId
    this.locale = options.locale ?? 'ar'
    this.setState('connecting')
    this.connectStartedAt = Date.now()
    this.firstAudioAt = 0

    if (!isVoiceLiveNetworkAllowed() || options.allowLive === false) {
      this.setState('error')
      this.handlers.onError?.('openai_realtime_live_disallowed')
      return {
        providerId: this.providerId,
        connected: false,
        live: false,
        endpointLabel: 'wss://api.openai.com/v1/realtime (live disallowed)',
      }
    }

    if (!isOpenAiRealtimeClientEnabled()) {
      this.setState('error')
      this.handlers.onError?.('openai_realtime_client_disabled')
      return {
        providerId: this.providerId,
        connected: false,
        live: false,
        endpointLabel: 'wss://api.openai.com/v1/realtime (client disabled)',
      }
    }

    try {
      const credentials = await this.mintEphemeralSession()
      this.credentials = credentials
      await this.openSocket(credentials)
      this.connected = true
      this.setState('listening')
      const voiceStart = Date.now() - this.connectStartedAt
      this.latencySamples.voiceStartMs.push(voiceStart)
      return {
        providerId: this.providerId,
        connected: true,
        live: true,
        endpointLabel: credentials.ws_url,
      }
    } catch (err) {
      this.connected = false
      this.setState('error')
      const message = err instanceof Error ? err.message : 'openai_realtime_connect_failed'
      this.handlers.onError?.(message)
      return {
        providerId: this.providerId,
        connected: false,
        live: false,
        endpointLabel: 'wss://api.openai.com/v1/realtime (connect failed)',
      }
    }
  }

  private async mintEphemeralSession(): Promise<OpenAiRealtimeSessionCredentials> {
    const response = await this.deps.fetchFn(this.deps.sessionPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: this.locale,
        conversationId: this.conversationId,
      }),
    })
    const data = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      throw new Error(String(data.code ?? data.error ?? 'openai_session_mint_failed'))
    }
    const clientSecret = typeof data.client_secret === 'string' ? data.client_secret : ''
    if (!clientSecret) throw new Error('openai_session_missing_secret')
    return {
      client_secret: clientSecret,
      expires_at: typeof data.expires_at === 'number' ? data.expires_at : null,
      model: typeof data.model === 'string' ? data.model : 'gpt-4o-realtime-preview',
      voice: typeof data.voice === 'string' ? data.voice : 'alloy',
      locale: data.locale === 'en' ? 'en' : 'ar',
      ws_url: typeof data.ws_url === 'string'
        ? data.ws_url
        : `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(String(data.model ?? 'gpt-4o-realtime-preview'))}`,
    }
  }

  private async openSocket(credentials: OpenAiRealtimeSessionCredentials): Promise<void> {
    const protocols = [
      'realtime',
      `openai-insecure-api-key.${credentials.client_secret}`,
      'openai-beta.realtime-v1',
    ]
    const socket = this.deps.createSocket(credentials.ws_url, protocols)
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        this.sendJson(buildSessionUpdateEvent(this.locale))
        resolve()
      }
      const onError = () => reject(new Error('openai_websocket_error'))
      socket.addEventListener('open', onOpen)
      socket.addEventListener('error', onError)
      socket.addEventListener('message', (ev) => {
        if (typeof ev.data === 'string') void this.onSocketMessage(ev.data)
      })
      socket.addEventListener('close', () => {
        if (this.connected) {
          this.connected = false
          this.handlers.onDisconnect?.()
          this.setState('disconnected')
        }
      })
      // Injected test sockets may already be OPEN
      if (socket.readyState === WS_OPEN) onOpen()
    })
  }

  private sendJson(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WS_OPEN) return
    this.socket.send(JSON.stringify(payload))
  }

  private async onSocketMessage(raw: string): Promise<void> {
    const event = parseRealtimeEvent(raw)
    if (!event) return
    const type = String(event.type ?? '')

    if (type === 'conversation.item.input_audio_transcription.delta') {
      const delta = String(event.delta ?? '')
      if (delta) {
        this.setState('transcribing')
        this.emitPartial(delta, false)
      }
      return
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = String(event.transcript ?? '')
      if (transcript) this.emitPartial(transcript, true)
      return
    }

    if (type === 'response.audio_transcript.delta' || type === 'response.text.delta') {
      const delta = String(event.delta ?? '')
      this.assistantAcc += delta
      this.setState('speaking')
      this.handlers.onAssistantPartial?.(this.assistantAcc)
      if (!this.firstAudioAt) {
        this.firstAudioAt = Date.now()
        this.latencySamples.roundTripMs.push(this.firstAudioAt - this.connectStartedAt)
      }
      return
    }

    if (type === 'response.audio_transcript.done' || type === 'response.text.done') {
      const text = String(event.transcript ?? event.text ?? this.assistantAcc)
      if (text) this.handlers.onAssistantFinal?.(text)
      this.assistantAcc = ''
      this.setState('listening')
      return
    }

    if (type === 'response.function_call_arguments.delta') {
      const callId = String(event.call_id ?? event.item_id ?? 'tool')
      const name = String(event.name ?? this.pendingToolArgs.get(callId)?.name ?? 'unknown')
      const prev = this.pendingToolArgs.get(callId)
      this.pendingToolArgs.set(callId, {
        name,
        callId,
        args: (prev?.args ?? '') + String(event.delta ?? ''),
      })
      return
    }

    if (type === 'response.function_call_arguments.done') {
      const callId = String(event.call_id ?? 'tool')
      const name = String(event.name ?? this.pendingToolArgs.get(callId)?.name ?? 'unknown')
      const argsRaw = String(event.arguments ?? this.pendingToolArgs.get(callId)?.args ?? '{}')
      this.pendingToolArgs.delete(callId)
      await this.handleMockToolCall(callId, name, argsRaw)
      return
    }

    if (type === 'error') {
      const message = String((event.error as { message?: string } | undefined)?.message ?? 'openai_realtime_error')
      this.handlers.onError?.(message)
    }
  }

  private async handleMockToolCall(callId: string, name: string, argsRaw: string): Promise<void> {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(argsRaw) as Record<string, unknown>
    } catch {
      args = {}
    }
    const decision = mapToolNameToDecision(name)
    const memory = createEmptyLiveTravelMemory()
    if (typeof args.destination === 'string') memory.destination = args.destination
    const events = new ExecutionEvents()
    const result = decision === 'none'
      ? null
      : await executeRuntimeTool({
        decision,
        memory,
        userText: typeof args.destination === 'string' ? String(args.destination) : name,
        events,
      })
    this.sendJson({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify({
          mock: true,
          tool: name,
          status: result?.status ?? 'completed',
          summary: result?.resultSummary ?? `Mock ${name} result`,
          data: null,
        }),
      },
    })
    this.sendJson({ type: 'response.create' })
  }

  override async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        this.socket.close()
      } catch {
        /* ignore */
      }
      this.socket = null
    }
    this.credentials = null
    await super.disconnect()
  }

  async pushAudio(chunk: ArrayBuffer): Promise<void> {
    if (!this.connected) return
    this.sendJson({
      type: 'input_audio_buffer.append',
      audio: arrayBufferToBase64(chunk),
    })
  }

  override async pushText(text: string, final = false): Promise<void> {
    // Text injection for tests / hybrid path when live socket is up
    if (!this.connected || !this.socket) {
      await super.pushText(text, final)
      return
    }
    this.setState('transcribing')
    this.emitPartial(text, final)
    if (final) {
      this.sendJson({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      })
      this.sendJson({ type: 'response.create' })
    }
  }

  override async speak(text: string): Promise<void> {
    if (!this.connected || !this.socket) {
      await super.speak(text)
      return
    }
    // Prefer model speech; also surface text for UI streaming cards.
    this.setState('speaking')
    this.handlers.onAssistantPartial?.(text)
    this.handlers.onAssistantFinal?.(text)
    this.sendJson({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: `Say this to the traveler naturally: ${text}`,
      },
    })
  }

  override async interrupt(): Promise<void> {
    this.sendJson({ type: 'response.cancel' })
    this.sendJson({ type: 'input_audio_buffer.clear' })
    this.assistantAcc = ''
    await super.interrupt()
  }

  getCredentials(): OpenAiRealtimeSessionCredentials | null {
    return this.credentials
  }
}

export function createOpenAIRealtimeProvider(
  deps?: OpenAiRealtimeProviderDeps,
): OpenAIRealtimeProvider {
  return new OpenAIRealtimeProvider(deps)
}
