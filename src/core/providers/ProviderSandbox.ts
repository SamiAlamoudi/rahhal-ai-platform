/**
 * Sprint 90 — sandbox mode helpers (reachability + mode gating).
 */

import type { ProviderMode, TravelProvider } from './types'
import { ProviderError } from './ProviderErrors'

export interface SandboxReachabilityResult {
  providerId: string
  reachable: boolean
  mode: ProviderMode
  detail: string
  latencyMs: number
}

export function assertModeAllowed(
  provider: TravelProvider,
  requested: ProviderMode,
): void {
  if (provider.mode === requested) return
  if (requested === 'live' && provider.mode !== 'live') {
    throw new ProviderError({
      code: 'PROVIDER_UNAVAILABLE',
      message: `Provider ${provider.id} is mode=${provider.mode}; live mode required`,
      providerId: provider.id,
      retryable: false,
    })
  }
}

/**
 * Probe sandbox reachability via health(). Sandbox providers must report ok.
 */
export async function checkSandboxReachable(
  provider: TravelProvider,
  options?: { timeoutMs?: number },
): Promise<SandboxReachabilityResult> {
  const started = performance.now()
  if (provider.mode === 'mock') {
    return {
      providerId: provider.id,
      reachable: true,
      mode: 'mock',
      detail: 'mock mode — sandbox probe skipped (always reachable locally)',
      latencyMs: 0,
    }
  }

  const controller = new AbortController()
  const timeoutMs = options?.timeoutMs ?? provider.limits().timeoutMs
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const health = await provider.health(controller.signal)
    clearTimeout(timer)
    return {
      providerId: provider.id,
      reachable: health.ok,
      mode: provider.mode,
      detail: health.ok ? 'sandbox reachable' : `sandbox unhealthy: ${health.detail}`,
      latencyMs: Math.round(performance.now() - started),
    }
  } catch (err) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : String(err)
    return {
      providerId: provider.id,
      reachable: false,
      mode: provider.mode,
      detail: `SANDBOX_UNREACHABLE: ${message}`,
      latencyMs: Math.round(performance.now() - started),
    }
  }
}

export function resolveOperatingMode(input: {
  liveEnabled?: boolean
  sandboxEnabled?: boolean
  forceMock?: boolean
}): ProviderMode {
  if (input.forceMock) return 'mock'
  if (input.liveEnabled) return 'live'
  if (input.sandboxEnabled) return 'sandbox'
  return 'mock'
}
