/**
 * Phase 7 — LatencyMonitor
 */

import type { LatencySnapshot, RealtimeMetrics, RealtimeVoiceProviderId, VoiceSessionState } from './types'

export class LatencyMonitor {
  private sttSamples: number[] = []
  private reasonSamples: number[] = []
  private ttsSamples: number[] = []
  private reconnectCount = 0
  private droppedPackets = 0
  private streamedChars = 0
  private streamStartedAt: number | null = null
  private providerState: VoiceSessionState = 'idle'
  private providerId: RealtimeVoiceProviderId = 'mock'

  setProvider(id: RealtimeVoiceProviderId): void {
    this.providerId = id
  }

  setState(state: VoiceSessionState): void {
    this.providerState = state
  }

  recordStt(ms: number): void {
    this.sttSamples.push(ms)
  }

  recordReason(ms: number): void {
    this.reasonSamples.push(ms)
  }

  recordTts(ms: number): void {
    this.ttsSamples.push(ms)
  }

  recordReconnect(): void {
    this.reconnectCount += 1
  }

  recordDroppedPacket(): void {
    this.droppedPackets += 1
  }

  beginStream(): void {
    this.streamStartedAt = Date.now()
    this.streamedChars = 0
  }

  addStreamChars(n: number): void {
    this.streamedChars += n
  }

  private avg(values: number[]): number {
    if (values.length === 0) return 0
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }

  snapshot(): LatencySnapshot {
    const sttMs = this.avg(this.sttSamples)
    const reasonMs = this.avg(this.reasonSamples)
    const ttsMs = this.avg(this.ttsSamples)
    return {
      sttMs,
      reasonMs,
      ttsMs,
      roundTripMs: sttMs + reasonMs + ttsMs,
      samples: this.sttSamples.length + this.reasonSamples.length + this.ttsSamples.length,
    }
  }

  metrics(): RealtimeMetrics {
    const elapsed = this.streamStartedAt ? Math.max(1, Date.now() - this.streamStartedAt) : 1
    return {
      latency: this.snapshot(),
      reconnectCount: this.reconnectCount,
      droppedPackets: this.droppedPackets,
      streamingCharsPerSec: Math.round((this.streamedChars / elapsed) * 1000),
      providerState: this.providerState,
      providerId: this.providerId,
    }
  }
}

export const LatencyMonitorApi = LatencyMonitor
