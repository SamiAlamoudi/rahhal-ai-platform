/**
 * Shared provider scaffolding.
 */

import type {
  PartialTranscript,
  VoiceConnectionInfo,
  VoiceProvider,
  VoiceProviderConnectOptions,
  VoiceProviderHandlers,
  VoiceSessionState,
  RealtimeVoiceProviderId,
  VoiceProviderCapabilities,
} from '../types'
import { transitionVoiceState } from '../voiceState'

export abstract class BaseVoiceProvider implements VoiceProvider {
  abstract readonly providerId: RealtimeVoiceProviderId
  abstract readonly displayName: string
  abstract readonly capabilities: VoiceProviderCapabilities
  abstract readonly isLive: boolean

  protected state: VoiceSessionState = 'idle'
  protected handlers: VoiceProviderHandlers = {}
  protected conversationId = ''
  protected locale: 'ar' | 'en' = 'ar'
  protected connected = false

  abstract isAvailable(): boolean

  setHandlers(handlers: VoiceProviderHandlers): void {
    this.handlers = handlers
  }

  getState(): VoiceSessionState {
    return this.state
  }

  protected setState(next: VoiceSessionState): void {
    this.state = transitionVoiceState(this.state, next)
    this.handlers.onState?.(this.state)
  }

  protected emitPartial(text: string, final: boolean): void {
    const partial: PartialTranscript = {
      text,
      final,
      at: new Date().toISOString(),
      locale: this.locale,
    }
    this.handlers.onPartialTranscript?.(partial)
    if (final) this.handlers.onFinalTranscript?.(text)
  }

  async connect(options: VoiceProviderConnectOptions): Promise<VoiceConnectionInfo> {
    this.conversationId = options.conversationId
    this.locale = options.locale ?? 'ar'
    this.setState('connecting')
    this.connected = true
    this.setState('listening')
    return {
      providerId: this.providerId,
      connected: true,
      live: this.isLive,
      endpointLabel: this.displayName,
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.setState('disconnected')
    this.handlers.onDisconnect?.()
    this.setState('idle')
  }

  async startListening(): Promise<void> {
    this.setState('listening')
  }

  async stopListening(): Promise<void> {
    if (this.state === 'listening' || this.state === 'transcribing') {
      this.setState('idle')
    }
  }

  async pushText(text: string, final = false): Promise<void> {
    this.setState('transcribing')
    this.emitPartial(text, final)
  }

  async speak(text: string): Promise<void> {
    this.setState('speaking')
    // Stream assistant text in small chunks for low-latency feel
    const parts = text.split(/(\s+)/).filter(Boolean)
    let acc = ''
    for (const part of parts) {
      acc += part
      this.handlers.onAssistantPartial?.(acc)
    }
    this.handlers.onAssistantFinal?.(text)
    this.setState('listening')
  }

  async interrupt(): Promise<void> {
    this.setState('interrupted')
    this.handlers.onState?.('interrupted')
    this.setState('listening')
  }
}
