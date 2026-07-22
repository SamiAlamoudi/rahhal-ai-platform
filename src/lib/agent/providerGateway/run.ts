/**
 * Sprint 104 — agent bridge for Live Provider Gateway.
 * When flag OFF: returns disabled response without touching providers.
 * When flag ON: delegates to core ProviderGateway (Amadeus Phase 1).
 */

import {
  SPRINT104_PROVIDER_GATEWAY_VERSION,
  createProviderGateway,
  type GatewayRequest,
  type GatewayResponse,
  type ProviderGateway,
  type ProviderGatewayOptions,
} from '../../../core/providerGateway'
import { isLiveProviderGatewayEnabled } from './feature'

export { isLiveProviderGatewayEnabled, LIVE_PROVIDER_GATEWAY_FEATURE_ID } from './feature'

export interface RunProviderGatewayOptions extends ProviderGatewayOptions {
  /** Override feature flag (tests). */
  readonly enabled?: boolean
  /** Inject a pre-built gateway (tests). */
  readonly gateway?: ProviderGateway
}

function disabledResponse(request: GatewayRequest): GatewayResponse {
  return {
    version: SPRINT104_PROVIDER_GATEWAY_VERSION,
    enabled: false,
    operation: request.operation,
    providerId: request.providerId ?? null,
    ok: false,
    offers: [],
    empty: true,
    partial: false,
    latencyMs: 0,
    attempts: 0,
    error: null,
    logs: ['live_provider_gateway_disabled'],
  }
}

/**
 * Execute a gateway request only when `ai.live_provider_gateway` is ON.
 * Flag OFF preserves identical legacy behavior (no live provider calls).
 */
export async function runLiveProviderGateway(
  request: GatewayRequest,
  options: RunProviderGatewayOptions = {},
): Promise<GatewayResponse> {
  if (!isLiveProviderGatewayEnabled({ enabled: options.enabled })) {
    return disabledResponse(request)
  }

  const gateway =
    options.gateway ??
    createProviderGateway({
      registry: options.registry,
      healthMonitor: options.healthMonitor,
      metrics: options.metrics,
      logger: options.logger,
      nowMs: options.nowMs,
      sleep: options.sleep,
      timeoutMs: options.timeoutMs,
      maxAttempts: options.maxAttempts,
    })

  return gateway.execute(request)
}

export function createLiveProviderGateway(
  options: RunProviderGatewayOptions = {},
): ProviderGateway | null {
  if (!isLiveProviderGatewayEnabled({ enabled: options.enabled })) {
    return null
  }
  return options.gateway ?? createProviderGateway(options)
}
