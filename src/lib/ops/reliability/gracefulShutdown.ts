/**
 * Graceful shutdown + degradation helpers (browser + worker compatible).
 */

export type ShutdownHook = () => void | Promise<void>

export class GracefulShutdown {
  private readonly hooks: ShutdownHook[] = []
  private shuttingDown = false

  onShutdown(hook: ShutdownHook): void {
    this.hooks.push(hook)
  }

  isShuttingDown(): boolean {
    return this.shuttingDown
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return
    this.shuttingDown = true
    for (const hook of this.hooks) {
      try {
        await hook()
      } catch {
        /* best-effort */
      }
    }
  }
}

let defaultShutdown: GracefulShutdown | null = null

export function getGracefulShutdown(): GracefulShutdown {
  if (!defaultShutdown) defaultShutdown = new GracefulShutdown()
  return defaultShutdown
}

export function resetGracefulShutdown(): void {
  defaultShutdown = null
}

/** Degrade to mock/safe mode decision. */
export function shouldGracefullyDegrade(input: {
  providerFailures: number
  circuitOpen: boolean
  envInvalid: boolean
}): boolean {
  if (input.envInvalid) return true
  if (input.circuitOpen) return true
  return input.providerFailures >= 5
}
