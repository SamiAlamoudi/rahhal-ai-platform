/**
 * Phase AK — enforce at most one live provider capability at a time.
 * Defaults remain OFF; this only clamps when multiple live flags were requested.
 */

import type { ProviderCapability, ProviderEnablementFlags } from './types'

/** Deterministic preference order when multiple live flags are set. */
export const LIVE_CAPABILITY_PRIORITY: ProviderCapability[] = [
  'flights',
  'hotels',
  'maps',
  'weather',
  'transport',
  'activities',
]

/** Phase AK primary sandbox candidate (documentation + probe wiring). */
export const PRIMARY_SANDBOX_PROVIDER_ID = 'amadeus' as const
export const PRIMARY_SANDBOX_CAPABILITY: ProviderCapability = 'flights'

export interface ExclusivityResolution {
  flags: ProviderEnablementFlags
  /** Capability retained as live when a clash occurred; null if none live. */
  allowedLiveCapability: ProviderCapability | null
  /** Capabilities that were requested live but suppressed by exclusivity. */
  suppressedCapabilities: ProviderCapability[]
  conflict: boolean
}

function parsePreferredCapability(
  env?: Record<string, string | undefined>,
): ProviderCapability | null {
  const raw = (
    env?.VITE_SINGLE_LIVE_CAPABILITY
    ?? env?.SINGLE_LIVE_CAPABILITY
    ?? ''
  ).trim().toLowerCase()
  if (!raw) return null
  if ((LIVE_CAPABILITY_PRIORITY as string[]).includes(raw)) {
    return raw as ProviderCapability
  }
  return null
}

/**
 * Clamp enablement so at most one capability remains live.
 * Prefer explicit VITE_SINGLE_LIVE_CAPABILITY, else flights (Phase AK primary),
 * else first in LIVE_CAPABILITY_PRIORITY that was requested live.
 */
export function enforceSingleLiveCapability(
  flags: ProviderEnablementFlags,
  env?: Record<string, string | undefined>,
): ExclusivityResolution {
  if (!flags.masterLive) {
    return {
      flags,
      allowedLiveCapability: null,
      suppressedCapabilities: [],
      conflict: false,
    }
  }

  const requestedLive = LIVE_CAPABILITY_PRIORITY.filter(
    (cap) => flags.capabilities[cap]?.live === true,
  )

  if (requestedLive.length <= 1) {
    return {
      flags,
      allowedLiveCapability: requestedLive[0] ?? null,
      suppressedCapabilities: [],
      conflict: false,
    }
  }

  const preferred = parsePreferredCapability(env)
  const keep =
    (preferred && requestedLive.includes(preferred) ? preferred : null)
    ?? (requestedLive.includes(PRIMARY_SANDBOX_CAPABILITY)
      ? PRIMARY_SANDBOX_CAPABILITY
      : null)
    ?? requestedLive[0]

  const suppressed = requestedLive.filter((cap) => cap !== keep)
  const capabilities = { ...flags.capabilities }
  for (const cap of suppressed) {
    capabilities[cap] = { ...capabilities[cap], live: false }
  }

  return {
    flags: { ...flags, capabilities },
    allowedLiveCapability: keep,
    suppressedCapabilities: suppressed,
    conflict: true,
  }
}

/** True when the capability is permitted to stay live under Phase AK exclusivity. */
export function isExclusiveLiveCapability(
  flags: ProviderEnablementFlags,
  capability: ProviderCapability,
  env?: Record<string, string | undefined>,
): boolean {
  const resolved = enforceSingleLiveCapability(flags, env)
  return resolved.allowedLiveCapability === capability
    && resolved.flags.capabilities[capability]?.live === true
}
