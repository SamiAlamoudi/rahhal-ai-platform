/**
 * Phase AJ — admin-only provider readiness diagnostics (no credentials / no env dumps).
 */

import { resolveProviderEnablementFlags } from './flags'
import { checkAllProviderReadiness } from './readiness'
import { selectAllCapabilities } from './selection'
import type { ProviderReadinessResult, ProviderSelectionDecision } from './types'

export interface DiagnosticsAuthUser {
  id: string
  role?: string | null
}

export interface ProviderDiagnosticsRequest {
  /** Authenticated user — must be admin. */
  user: DiagnosticsAuthUser | null
  env?: Record<string, string | undefined>
  circuitState?: Record<string, 'closed' | 'open' | 'half_open'>
  /** Explicit opt-in marker for probe mode (diagnostics remain config-only). */
  sandboxProbe?: boolean
}

export interface ProviderDiagnosticsReport {
  generatedAt: string
  masterLive: boolean
  mockFallbackEnabled: boolean
  strictLive: boolean
  paymentProvider: 'mock'
  /** Phase AK — at most one live capability. */
  allowedLiveCapability: string | null
  exclusivitySuppressed: string[]
  primarySandboxProvider: 'amadeus'
  readiness: Array<{
    provider: string
    capability: string
    configured: boolean
    enabled: boolean
    environment: string
    healthy: boolean
    reason: string
    fallbackAvailable: boolean
    checkedAt: string
    circuitState: string
    secretsPresent: Array<{ name: string; present: boolean; masked: string }>
  }>
  selections: Array<{
    capability: string
    selectedProviderId: string
    source: string
    outcome: string
    reason: string
    fallbackUsed: boolean
  }>
}

export type ProviderDiagnosticsResult =
  | { ok: true; report: ProviderDiagnosticsReport }
  | { ok: false; status: 401 | 403; error: string }

function isAdmin(user: DiagnosticsAuthUser | null): boolean {
  return Boolean(user && user.role === 'admin')
}

function sanitizeReadiness(row: ProviderReadinessResult) {
  return {
    provider: row.provider,
    capability: row.capability,
    configured: row.configured,
    enabled: row.enabled,
    environment: row.environment,
    healthy: row.healthy,
    reason: row.reason,
    fallbackAvailable: row.fallbackAvailable,
    checkedAt: row.checkedAt,
    circuitState: row.circuitState ?? 'unknown',
    secretsPresent: row.secrets.map((s) => ({
      name: s.name,
      present: s.present,
      masked: s.present ? '[set]' : '[missing]',
    })),
  }
}

function sanitizeSelection(row: ProviderSelectionDecision) {
  return {
    capability: row.capability,
    selectedProviderId: row.selectedProviderId,
    source: row.source,
    outcome: row.outcome,
    reason: row.reason,
    fallbackUsed: row.fallbackUsed,
  }
}

/**
 * Admin-only readiness view. Never returns credentials or raw env values.
 * Does not call external APIs.
 */
export function getProviderDiagnostics(
  request: ProviderDiagnosticsRequest,
): ProviderDiagnosticsResult {
  if (!request.user) {
    return { ok: false, status: 401, error: 'Authentication required.' }
  }
  if (!isAdmin(request.user)) {
    return { ok: false, status: 403, error: 'Admin access required.' }
  }

  const flags = resolveProviderEnablementFlags(request.env)
  const readiness = checkAllProviderReadiness({
    env: request.env,
    flags,
    circuitState: request.circuitState,
    sandboxProbe: request.sandboxProbe === true,
  })
  const selections = selectAllCapabilities({
    env: request.env,
    flags,
    circuitState: request.circuitState,
  })

  return {
    ok: true,
    report: {
      generatedAt: new Date().toISOString(),
      masterLive: flags.masterLive,
      mockFallbackEnabled: flags.mockFallbackEnabled,
      strictLive: flags.strictLive,
      paymentProvider: 'mock',
      allowedLiveCapability: flags.allowedLiveCapability ?? null,
      exclusivitySuppressed: flags.exclusivitySuppressed ?? [],
      primarySandboxProvider: 'amadeus',
      readiness: readiness.map(sanitizeReadiness),
      selections: selections.map(sanitizeSelection),
    },
  }
}
