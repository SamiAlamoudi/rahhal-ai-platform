/**
 * Phase 7 — ReconnectManager
 */

export class ReconnectManager {
  private attempts = 0
  private readonly maxAttempts: number
  private readonly baseDelayMs: number

  constructor(opts?: { maxAttempts?: number; baseDelayMs?: number }) {
    this.maxAttempts = opts?.maxAttempts ?? 3
    this.baseDelayMs = opts?.baseDelayMs ?? 200
  }

  getAttempts(): number {
    return this.attempts
  }

  reset(): void {
    this.attempts = 0
  }

  canRetry(): boolean {
    return this.attempts < this.maxAttempts
  }

  /** Deterministic backoff delay (no wall-clock sleep in unit path). */
  nextDelayMs(): number {
    this.attempts += 1
    return this.baseDelayMs * 2 ** Math.max(0, this.attempts - 1)
  }

  async waitAndRetry(connect: () => Promise<boolean>): Promise<boolean> {
    while (this.canRetry()) {
      this.nextDelayMs()
      const ok = await connect()
      if (ok) {
        this.reset()
        return true
      }
    }
    return false
  }
}
