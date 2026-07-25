/**
 * Phase 7 — VoiceSession façade over RealtimeSession.
 */

import { RealtimeSession, type RealtimeSessionOptions } from './realtimeSession'
import type { RealtimeMetrics, RealtimeVoiceProviderId, VoiceSessionEvent, VoiceSessionState } from './types'

export class VoiceSession {
  private readonly realtime: RealtimeSession

  constructor(options: RealtimeSessionOptions) {
    this.realtime = new RealtimeSession(options)
  }

  async start(): Promise<void> {
    await this.realtime.connect()
  }

  async stop(): Promise<void> {
    await this.realtime.disconnect()
  }

  async interrupt(): Promise<void> {
    await this.realtime.interrupt()
  }

  async pushTranscript(text: string, final = false): Promise<void> {
    await this.realtime.pushUserText(text, final)
  }

  getState(): VoiceSessionState {
    return this.realtime.getState()
  }

  getEvents(): VoiceSessionEvent[] {
    return this.realtime.getEvents()
  }

  getMetrics(): RealtimeMetrics {
    return this.realtime.getMetrics()
  }

  getProviderId(): RealtimeVoiceProviderId | null {
    return this.realtime.getProvider()?.providerId ?? null
  }

  getRealtime(): RealtimeSession {
    return this.realtime
  }
}

export function createVoiceSession(options: RealtimeSessionOptions): VoiceSession {
  return new VoiceSession(options)
}
