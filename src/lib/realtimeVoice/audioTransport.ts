/**
 * Phase 7 — AudioTransport
 * Buffering seam for streaming audio. No real mic capture in unit tests.
 */

import type { AudioTransportState } from './types'

export class AudioTransport {
  private state: AudioTransportState = 'closed'
  private readonly outbound: ArrayBuffer[] = []
  private readonly inbound: ArrayBuffer[] = []
  private dropped = 0

  getState(): AudioTransportState {
    return this.state
  }

  open(): void {
    this.state = 'open'
  }

  close(): void {
    this.state = 'closed'
    this.outbound.length = 0
    this.inbound.length = 0
  }

  markDegraded(): void {
    this.state = 'degraded'
  }

  enqueueOutbound(chunk: ArrayBuffer): void {
    if (this.state === 'closed') {
      this.dropped += 1
      return
    }
    this.outbound.push(chunk)
    if (this.outbound.length > 64) {
      this.outbound.shift()
      this.dropped += 1
    }
  }

  enqueueInbound(chunk: ArrayBuffer): void {
    if (this.state === 'closed') {
      this.dropped += 1
      return
    }
    this.inbound.push(chunk)
  }

  drainOutbound(): ArrayBuffer[] {
    const out = this.outbound.slice()
    this.outbound.length = 0
    return out
  }

  getDroppedCount(): number {
    return this.dropped
  }
}
