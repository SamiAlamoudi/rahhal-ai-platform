/**
 * Phase 7 — RealtimeSession
 * Streaming transcription → incremental Agent Runtime reasoning → streaming TTS.
 */

import { runAgentRuntime } from '../agent/agentRuntime'
import type { LiveTravelMemory } from '../agent/conversationIntelligence'
import { AudioTransport } from './audioTransport'
import { LatencyMonitor } from './latencyMonitor'
import { ReconnectManager } from './reconnectManager'
import { connectWithFailover } from './providers/factory'
import type {
  RealtimeMetrics,
  RealtimeVoiceProviderId,
  VoiceProvider,
  VoiceSessionEvent,
  VoiceSessionState,
} from './types'
import { VoiceConnection } from './voiceConnection'

export interface RealtimeSessionOptions {
  conversationId: string
  locale?: 'ar' | 'en'
  preferredProvider?: RealtimeVoiceProviderId
  /** When false, skip agent runtime (tests). Default true. */
  useAgentRuntime?: boolean
}

export class RealtimeSession {
  private readonly options: RealtimeSessionOptions
  private readonly connection = new VoiceConnection()
  private readonly transport = new AudioTransport()
  private readonly latency = new LatencyMonitor()
  private readonly reconnect = new ReconnectManager()
  private readonly events: VoiceSessionEvent[] = []
  private state: VoiceSessionState = 'idle'
  private memory: LiveTravelMemory | null = null
  private lastPartial = ''
  private speaking = false

  constructor(options: RealtimeSessionOptions) {
    this.options = options
  }

  getState(): VoiceSessionState {
    return this.state
  }

  getEvents(): VoiceSessionEvent[] {
    return this.events.slice()
  }

  getMetrics(): RealtimeMetrics {
    return this.latency.metrics()
  }

  getProvider(): VoiceProvider | null {
    return this.connection.getProvider()
  }

  getMemory(): LiveTravelMemory | null {
    return this.memory
  }

  private emit(
    type: VoiceSessionEvent['type'],
    detail: string,
    meta?: Record<string, unknown>,
  ): void {
    this.events.push({ type, at: new Date().toISOString(), detail, meta })
  }

  private setState(state: VoiceSessionState): void {
    this.state = state
    this.latency.setState(state)
    this.emit('state', state)
  }

  async connect(): Promise<VoiceConnection> {
    this.setState('connecting')
    const { provider, connection } = await connectWithFailover({
      conversationId: this.options.conversationId,
      locale: this.options.locale,
      preferred: this.options.preferredProvider,
    })

    if (!connection.connected) {
      this.setState('reconnecting')
      const ok = await this.reconnect.waitAndRetry(async () => {
        const again = await connectWithFailover({
          conversationId: this.options.conversationId,
          locale: this.options.locale,
          preferred: 'mock',
        })
        if (again.connection.connected) {
          this.connection.attach(again.provider, again.connection)
          this.wireProvider(again.provider)
          return true
        }
        return false
      })
      if (!ok) {
        this.setState('error')
        this.emit('error', 'connect_failed')
        return this.connection
      }
      this.latency.recordReconnect()
      this.emit('reconnected', this.connection.getProviderId() ?? 'mock')
    } else {
      this.connection.attach(provider, connection)
      this.wireProvider(provider)
      if (connection.failoverFrom) {
        this.emit('failover', `${connection.failoverFrom}->${connection.providerId}`)
      }
    }

    this.latency.setProvider(this.connection.getProviderId() ?? 'mock')
    this.transport.open()
    this.setState('listening')
    await this.connection.getProvider()?.startListening()
    return this.connection
  }

  private wireProvider(provider: VoiceProvider): void {
    provider.setHandlers({
      onState: (s) => this.setState(s),
      onPartialTranscript: (p) => {
        void this.onPartial(p.text, p.final)
      },
      onFinalTranscript: (text) => {
        void this.onPartial(text, true)
      },
      onAssistantPartial: (text) => {
        this.latency.addStreamChars(text.length)
        this.emit('assistant_partial', text.slice(-80))
      },
      onAssistantFinal: (text) => {
        this.emit('assistant_final', text.slice(0, 120))
        this.speaking = false
        this.setState('listening')
      },
      onError: (message) => this.emit('error', message),
      onDisconnect: () => {
        this.transport.close()
        this.setState('disconnected')
      },
    })
  }

  /**
   * Incremental transcript path — updates memory while user is still speaking.
   */
  async onPartial(text: string, final: boolean): Promise<void> {
    const t0 = Date.now()
    this.lastPartial = text
    this.setState(final ? 'reasoning' : 'transcribing')
    this.emit(final ? 'final_transcript' : 'partial_transcript', text)

    if (this.options.useAgentRuntime === false) {
      this.latency.recordStt(Date.now() - t0)
      return
    }

    // Incremental reasoning on partials (low latency) and finals
    const reasonStart = Date.now()
    const result = await runAgentRuntime({
      userText: text,
      locale: this.options.locale,
      sessionId: this.options.conversationId,
      priorMemory: this.memory,
      interruptAfter: this.speaking ? 'thinking' : null,
    })
    this.memory = result.memory
    this.latency.recordStt(reasonStart - t0)
    this.latency.recordReason(Date.now() - reasonStart)

    if (!final && text.trim().length < 8) {
      this.setState('listening')
      return
    }

    if (result.interrupted) {
      this.emit('interrupted', 'runtime')
      this.setState('interrupted')
      return
    }

    const ttsStart = Date.now()
    this.speaking = true
    this.setState('speaking')
    this.latency.beginStream()
    await this.connection.getProvider()?.speak(result.responseText)
    this.latency.recordTts(Date.now() - ttsStart)
  }

  /**
   * Inject mic / STT text (mock, tests, web-speech bridge).
   * Awaits incremental Agent Runtime + TTS so callers observe final state.
   */
  async pushUserText(text: string, final = false): Promise<void> {
    await this.onPartial(text, final)
  }

  async interrupt(): Promise<void> {
    this.speaking = false
    await this.connection.getProvider()?.interrupt()
    this.emit('interrupted', 'user')
    this.setState('interrupted')
    // Instant re-listen
    this.setState('listening')
    await this.connection.getProvider()?.startListening()
  }

  async disconnect(): Promise<void> {
    this.transport.close()
    await this.connection.disconnect()
    this.setState('idle')
  }

  getLastPartial(): string {
    return this.lastPartial
  }

  getTransport(): AudioTransport {
    return this.transport
  }
}
